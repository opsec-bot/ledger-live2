import { BigNumber } from "bignumber.js";
import { findCryptoCurrencyById } from "@domain/entity-currency-crypto";
import type { Unit } from "@domain/entity-currency-unit";

/**
 * Flex Mode is a cosmetic, local-only display toggle: it never reads or writes
 * any real account/balance data, and is only ever wired into pure display
 * formatting (see the callers of `useFlexPortfolio`). It must never be
 * consulted on Send/Receive/Swap or any screen that constructs a transaction.
 *
 * This module owns the whole display model: the user edits a per-asset amount
 * (or fiat value) in Settings, and every Flex-Mode-aware display hook reads the
 * resulting `FlexPortfolio` — the portfolio total is always the sum of the
 * per-asset fiat values, never a preset.
 */

/**
 * One asset the user can customise. Adding an entry here is all that is needed
 * to support a new asset: defaults, the settings page, lookups and the total
 * are all derived from this registry.
 */
export type FlexModeSupportedAsset = {
  readonly currencyId: string;
  readonly ticker: string;
  /** Default quantity, in the currency's human-readable unit. */
  readonly defaultAmount: string;
  /** Rough reference price, used only to seed defaults and as a fallback when live prices aren't loaded. */
  readonly referencePriceUsd: number;
};

export const FLEX_MODE_SUPPORTED_ASSETS: readonly FlexModeSupportedAsset[] = [
  { currencyId: "bitcoin", ticker: "BTC", defaultAmount: "3.42", referencePriceUsd: 118_781 },
  { currencyId: "ethereum", ticker: "ETH", defaultAmount: "74.18", referencePriceUsd: 3_801 },
  { currencyId: "solana", ticker: "SOL", defaultAmount: "1920", referencePriceUsd: 191.6 },
  { currencyId: "litecoin", ticker: "LTC", defaultAmount: "812", referencePriceUsd: 120 },
];

/**
 * Persisted per-asset override. Stored as decimal strings so that BigNumber
 * precision survives the JSON round-trip through settings storage.
 * `amount` is in the currency's human unit, `fiatValue` in the counter-value
 * currency's human unit.
 */
export type FlexModeAssetSetting = {
  readonly amount: string;
  readonly fiatValue: string;
};

/** Keyed by ledger currency id (e.g. `bitcoin`). */
export type FlexModeAssetsSettings = Readonly<Record<string, FlexModeAssetSetting>>;

/** One resolved asset of the display portfolio. */
export interface FlexAsset {
  readonly currencyId: string;
  readonly ticker: string;
  /** Quantity in the currency's human unit (e.g. `3.42` BTC). */
  readonly amount: BigNumber;
  /** Value in the counter-value currency's human unit (e.g. `406231` USD). */
  readonly fiatValue: BigNumber;
  /**
   * True when the asset was pulled in from the user's real holdings and scaled up,
   * rather than coming from an explicit setting or a registry default.
   */
  readonly isAuto?: boolean;
}

/** The complete Flex Mode display portfolio consumed by every display hook. */
export interface FlexPortfolio {
  /** Sorted by `fiatValue`, descending. */
  readonly assets: readonly FlexAsset[];
  readonly totalFiat: BigNumber;
}

export const EMPTY_FLEX_PORTFOLIO: FlexPortfolio = {
  assets: [],
  totalFiat: new BigNumber(0),
};

function toPositiveBigNumber(value: string | number | undefined): BigNumber | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = new BigNumber(value);
  if (!parsed.isFinite() || parsed.isNegative()) return undefined;
  return parsed;
}

function resolveTicker(currencyId: string): string {
  const supported = FLEX_MODE_SUPPORTED_ASSETS.find(asset => asset.currencyId === currencyId);
  if (supported) return supported.ticker;
  return findCryptoCurrencyById(currencyId)?.ticker ?? currencyId.toUpperCase();
}

/** Default overrides derived from the registry, used when nothing is persisted yet. */
export function getDefaultFlexModeAssets(): FlexModeAssetsSettings {
  return Object.fromEntries(
    FLEX_MODE_SUPPORTED_ASSETS.map(asset => [
      asset.currencyId,
      {
        amount: asset.defaultAmount,
        fiatValue: new BigNumber(asset.defaultAmount)
          .times(asset.referencePriceUsd)
          .toFixed(2)
          .toString(),
      },
    ]),
  );
}

/**
 * An asset the user actually holds that has no Flex Mode entry yet.
 * Its real values get multiplied up rather than shown as-is, so nothing real is
 * ever displayed while Flex Mode is on. Deriving both sides from the same
 * multiplier keeps the pair consistent without needing a market price.
 */
export type HeldAsset = {
  readonly currencyId: string;
  readonly ticker: string;
  /** Real quantity, in the currency's human unit. */
  readonly amount: BigNumber;
  /** Real value, in the counter-value currency's human unit. */
  readonly fiatValue: BigNumber;
};

/**
 * How much to scale up a held asset that the user hasn't customised. Chosen so a
 * few hundred dollars reads as a few tens of thousands, in the same ballpark as
 * the registry defaults.
 */
export const FLEX_MODE_AUTO_MULTIPLIER = 100;

export function autoIncludeHeldAsset(held: HeldAsset): FlexAsset {
  return {
    currencyId: held.currencyId,
    ticker: held.ticker,
    amount: held.amount.times(FLEX_MODE_AUTO_MULTIPLIER),
    fiatValue: held.fiatValue.times(FLEX_MODE_AUTO_MULTIPLIER),
    isAuto: true,
  };
}

/**
 * The price implied by an asset's own display values. Used to keep the two
 * settings fields in sync without needing a live market price — and it is the
 * only rate that keeps the pair self-consistent for an auto-included asset.
 */
export function impliedFlexPrice(asset: FlexAsset): BigNumber | undefined {
  if (asset.amount.isLessThanOrEqualTo(0)) return undefined;
  const price = asset.fiatValue.div(asset.amount);
  return price.isFinite() && price.isGreaterThan(0) ? price : undefined;
}

/**
 * Resolves the persisted settings into the display portfolio.
 * Supported assets always appear (falling back to their registry default), and
 * any extra persisted currency id is included too, so the settings shape can
 * grow beyond the current registry without a migration.
 *
 * `heldAssets` covers everything the user holds that has no entry yet — those
 * get scaled up so no real balance leaks into the display.
 */
export function buildFlexPortfolio(
  settings: FlexModeAssetsSettings = {},
  heldAssets: readonly HeldAsset[] = [],
): FlexPortfolio {
  const defaults = getDefaultFlexModeAssets();
  const currencyIds = [
    ...FLEX_MODE_SUPPORTED_ASSETS.map(asset => asset.currencyId),
    ...Object.keys(settings).filter(
      id => !FLEX_MODE_SUPPORTED_ASSETS.some(asset => asset.currencyId === id),
    ),
  ];

  const assets = currencyIds.reduce<FlexAsset[]>((acc, currencyId) => {
    const stored = settings[currencyId];
    const fallback = defaults[currencyId];
    const amount = toPositiveBigNumber(stored?.amount) ?? toPositiveBigNumber(fallback?.amount);
    const fiatValue =
      toPositiveBigNumber(stored?.fiatValue) ?? toPositiveBigNumber(fallback?.fiatValue);
    if (amount === undefined || fiatValue === undefined) return acc;

    acc.push({ currencyId, ticker: resolveTicker(currencyId), amount, fiatValue });
    return acc;
  }, []);

  const covered = new Set(assets.map(asset => asset.currencyId));
  for (const held of heldAssets) {
    if (covered.has(held.currencyId) || held.amount.isLessThanOrEqualTo(0)) continue;
    covered.add(held.currencyId);
    assets.push(autoIncludeHeldAsset(held));
  }

  assets.sort((a, b) => b.fiatValue.comparedTo(a.fiatValue) ?? 0);

  return {
    assets,
    totalFiat: assets.reduce((sum, asset) => sum.plus(asset.fiatValue), new BigNumber(0)),
  };
}

/**
 * The fraction of an asset's display value that belongs to one row.
 *
 * Screens differ in granularity: the assets list renders one row per currency
 * (whole asset), while the Accounts page and the asset-detail address list
 * render one row per account. Scaling each row by its real share of the
 * currency's balance keeps account rows summing to the asset total, and asset
 * totals summing to the portfolio total.
 *
 * When there is no real balance to apportion (no accounts, or all empty) the
 * whole value is shown — there is nothing to split.
 */
export function computeFlexShare(realBalance: BigNumber, totalRealBalance: BigNumber): BigNumber {
  if (!totalRealBalance.isFinite() || totalRealBalance.isLessThanOrEqualTo(0)) {
    return new BigNumber(1);
  }
  const share = realBalance.div(totalRealBalance);
  if (!share.isFinite() || share.isNegative()) return new BigNumber(0);
  return BigNumber.minimum(share, 1);
}

export function scaleFlexAsset(asset: FlexAsset, share: BigNumber): FlexAsset {
  if (share.isEqualTo(1)) return asset;
  return {
    ...asset,
    amount: asset.amount.times(share),
    fiatValue: asset.fiatValue.times(share),
  };
}

/** An asset's share of the display portfolio, as a percentage (0–100). */
export function flexDistributionPercentage(portfolio: FlexPortfolio, asset: FlexAsset): number {
  if (portfolio.totalFiat.isLessThanOrEqualTo(0)) return 0;
  return asset.fiatValue.div(portfolio.totalFiat).times(100).toNumber();
}

/**
 * Profit/loss numbers implied by the display portfolio, so the PnL cards agree
 * with the fixed uptick shown on the balance headers instead of reporting the
 * real cost basis next to made-up balances.
 */
export function buildFlexPnl(totalFiat: BigNumber): {
  costBasis: BigNumber;
  lifetimeCost: BigNumber;
  unrealisedPnL: BigNumber;
  realisedPnL: BigNumber;
  totalPnL: BigNumber;
} {
  const costBasis = totalFiat.div(1 + FLEX_MODE_VALUE_CHANGE_PERCENTAGE);
  const unrealisedPnL = totalFiat.minus(costBasis);
  return {
    costBasis,
    lifetimeCost: costBasis,
    unrealisedPnL,
    realisedPnL: new BigNumber(0),
    totalPnL: unrealisedPnL,
  };
}

/** How a display hook identifies the asset it is rendering. */
export type FlexAssetRef = {
  readonly currencyId?: string;
  readonly ticker?: string;
};

export function findFlexAsset(
  portfolio: FlexPortfolio,
  { currencyId, ticker }: FlexAssetRef,
): FlexAsset | undefined {
  const upperTicker = ticker?.toUpperCase();
  return portfolio.assets.find(
    asset =>
      (currencyId !== undefined && asset.currencyId === currencyId) ||
      (upperTicker !== undefined && asset.ticker === upperTicker),
  );
}

/**
 * Builds a lookup ref from whatever currency a display component has.
 * `Currency` includes fiat currencies, which have no `id`, so the ticker is the
 * only always-available key.
 */
export function flexAssetRefFromCurrency(currency: { ticker: string; id?: string }): FlexAssetRef {
  return { currencyId: "id" in currency ? currency.id : undefined, ticker: currency.ticker };
}

export function isFlexModeAsset(tickerCode: string): boolean {
  return FLEX_MODE_SUPPORTED_ASSETS.some(asset => asset.ticker === tickerCode.toUpperCase());
}

/** Converts a human-unit value into the smallest display unit `formatCurrencyUnit` expects. */
export function toBaseUnits(value: BigNumber, unit: Unit): BigNumber {
  return value.times(new BigNumber(10).pow(unit.magnitude));
}

/** Keeps the fiat field in sync when the user edits the quantity. */
export function fiatValueFromAmount(amount: BigNumber, price: BigNumber): BigNumber {
  return amount.times(price);
}

/** Keeps the quantity field in sync when the user edits the fiat value. */
export function amountFromFiatValue(fiatValue: BigNumber, price: BigNumber): BigNumber {
  if (price.isZero() || !price.isFinite()) return new BigNumber(0);
  return fiatValue.div(price);
}

/**
 * Parses free-form user input from the settings page. Tolerates grouping
 * separators and a trailing decimal separator while the user is still typing.
 */
export function parseFlexAmountInput(raw: string): BigNumber | undefined {
  const normalized = raw.replace(/\s/g, "").replace(/,/g, "");
  if (normalized === "" || normalized === ".") return undefined;
  const parsed = new BigNumber(normalized);
  if (!parsed.isFinite() || parsed.isNegative()) return undefined;
  return parsed;
}

export type FlexBalanceHistoryPoint = { date: Date; value: number };

/**
 * Gentle, deterministic rising curve ending exactly at `target`.
 * `index` 0 is the oldest point, `count - 1` the newest.
 */
function flexCurveValue(target: number, index: number, count: number): number {
  if (count <= 1) return target;
  const isLast = index === count - 1;
  const progress = index / (count - 1);
  const base = target * (0.7 + 0.3 * progress);
  const noise = isLast ? 0 : Math.sin(index * 1.7) * target * 0.015;
  return Math.max(0, base + noise);
}

/**
 * Replaces the values of a real balance history, keeping its dates.
 *
 * Reusing the real timestamps means the chart's x-axis, tick spacing and
 * selected range stay correct — a fabricated daily series would mislabel the
 * intraday and multi-year ranges.
 */
export function projectFlexBalanceHistory(
  totalFiat: BigNumber,
  fiatUnit: Unit,
  realHistory: readonly FlexBalanceHistoryPoint[],
): FlexBalanceHistoryPoint[] {
  const target = toBaseUnits(totalFiat, fiatUnit).toNumber();
  return realHistory.map((point, index) => ({
    date: point.date,
    value: flexCurveValue(target, index, realHistory.length),
  }));
}

/** Same curve over fabricated daily points, for when there is no real history to follow. */
export function buildFlexBalanceHistory(
  totalFiat: BigNumber,
  fiatUnit: Unit,
  points = 30,
): FlexBalanceHistoryPoint[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const target = toBaseUnits(totalFiat, fiatUnit).toNumber();

  return Array(Math.max(1, points))
    .fill(null)
    .map((_, i, all) => ({
      date: new Date(now - (all.length - 1 - i) * day),
      value: flexCurveValue(target, i, all.length),
    }));
}

/** Flex Mode always shows a modest fake uptick rather than mirroring the real trend. */
export const FLEX_MODE_VALUE_CHANGE_PERCENTAGE = 0.021;
