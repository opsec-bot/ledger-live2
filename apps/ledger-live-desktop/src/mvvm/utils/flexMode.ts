import { BigNumber } from "bignumber.js";
import type { Unit } from "@domain/entity-currency-unit";

/**
 * Flex Mode is a cosmetic, local-only display toggle: it never reads or writes
 * any real account/balance data, and is only ever wired into pure display
 * formatting (see the callers of `getFlexAssetBaseUnits`). It must never be
 * consulted on Send/Receive/Swap or any screen that constructs a transaction.
 */

type FlexAsset = {
  ticker: string;
  allocation: number;
  /** Rough reference price used only to derive a plausible-looking quantity for display. */
  referencePriceUsd: number;
};

export const FLEX_MODE_ASSETS: readonly FlexAsset[] = [
  { ticker: "BTC", allocation: 0.45, referencePriceUsd: 65_000 },
  { ticker: "ETH", allocation: 0.3, referencePriceUsd: 3_200 },
  { ticker: "SOL", allocation: 0.15, referencePriceUsd: 150 },
  { ticker: "LTC", allocation: 0.1, referencePriceUsd: 85 },
];

export function isFlexModeAsset(tickerCode: string): boolean {
  return FLEX_MODE_ASSETS.some(asset => asset.ticker === tickerCode.toUpperCase());
}

export function getFlexAssetFiatUsd(tickerCode: string, targetUsd: number): number | undefined {
  const asset = FLEX_MODE_ASSETS.find(a => a.ticker === tickerCode.toUpperCase());
  return asset ? targetUsd * asset.allocation : undefined;
}

function getFlexAssetQuantity(tickerCode: string, targetUsd: number): number | undefined {
  const asset = FLEX_MODE_ASSETS.find(a => a.ticker === tickerCode.toUpperCase());
  return asset ? (targetUsd * asset.allocation) / asset.referencePriceUsd : undefined;
}

/** Fake balance for one asset, in the currency's smallest display unit (matches formatCurrencyUnit's expected input). */
export function getFlexAssetBaseUnits(
  tickerCode: string,
  targetUsd: number,
  unit: Unit,
): BigNumber | undefined {
  const quantity = getFlexAssetQuantity(tickerCode, targetUsd);
  if (quantity === undefined) return undefined;
  return new BigNumber(quantity).times(new BigNumber(10).pow(unit.magnitude));
}

/** Fake fiat total, in the fiat currency's smallest display unit. */
export function getFlexModeFiatBaseUnits(targetUsd: number, fiatUnit: Unit): BigNumber {
  return new BigNumber(targetUsd).times(new BigNumber(10).pow(fiatUnit.magnitude));
}

export type FlexBalanceHistoryPoint = { date: Date; value: number };

/** Gentle, deterministic fake balance-over-time curve ending at the target, for the portfolio chart. */
export function buildFlexBalanceHistory(
  targetUsd: number,
  fiatUnit: Unit,
  points = 30,
): FlexBalanceHistoryPoint[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const magnitudeFactor = new BigNumber(10).pow(fiatUnit.magnitude).toNumber();

  return Array(points)
    .fill(null)
    .map((_, i) => {
      const progress = i / (points - 1);
      const base = targetUsd * (0.7 + 0.3 * progress);
      const noise = i === points - 1 ? 0 : Math.sin(i * 1.7) * targetUsd * 0.015;
      return {
        date: new Date(now - (points - 1 - i) * day),
        value: Math.max(0, base + noise) * magnitudeFactor,
      };
    });
}

export const FLEX_MODE_TARGET_PRESETS = [100_000, 1_000_000, 5_000_000, 10_000_000] as const;
