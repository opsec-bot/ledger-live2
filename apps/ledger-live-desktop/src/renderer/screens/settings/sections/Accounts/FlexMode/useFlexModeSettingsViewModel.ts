import { useCallback, useMemo, useState } from "react";
import { BigNumber } from "bignumber.js";
import { useTranslation } from "react-i18next";
import { useSelector } from "LLD/hooks/redux";
import { findCryptoCurrencyById } from "@domain/entity-currency-crypto";
import type { CryptoCurrency } from "@domain/entity-currency-crypto";
import { formatCurrencyUnit } from "@ledgerhq/live-common/currencies/index";
import { counterValueCurrencySelector, localeSelector } from "~/renderer/reducers/settings";
import { useFlexMode, useFlexModeAssets } from "~/renderer/actions/settings";
import { useFlexPortfolio } from "LLD/hooks/useFlexPortfolio";
import { useFlexModePrices } from "LLD/hooks/useFlexModePrices";
import { useAnimatedNumber } from "LLD/hooks/useAnimatedNumber";
import {
  amountFromFiatValue,
  buildFlexPortfolio,
  fiatValueFromAmount,
  impliedFlexPrice,
  parseFlexAmountInput,
  toBaseUnits,
  type FlexAsset,
  type FlexModeAssetsSettings,
} from "LLD/utils/flexMode";

const MAX_AMOUNT_DECIMALS = 8;
const MAX_FIAT_DECIMALS = 2;

type EditableField = "amount" | "fiatValue";

/** Which field is mid-edit. Only one at a time, so the other always shows the synced value. */
type DraftState = {
  readonly currencyId: string;
  readonly field: EditableField;
  readonly raw: string;
  /** Row order captured when editing started, so auto-sort can't move the focused input. */
  readonly order: readonly string[];
};

export type FlexModeAssetRow = {
  readonly currencyId: string;
  readonly ticker: string;
  readonly name: string;
  readonly currency?: CryptoCurrency;
  readonly amountText: string;
  readonly fiatText: string;
  /** True while the row's values are derived from a real holding rather than set explicitly. */
  readonly isAuto: boolean;
  readonly onAmountChange: (raw: string) => void;
  readonly onFiatChange: (raw: string) => void;
  readonly onBlur: () => void;
};

export function useFlexModeSettingsViewModel() {
  const { t } = useTranslation();
  const locale = useSelector(localeSelector);
  const counterValueCurrency = useSelector(counterValueCurrencySelector);
  const [flexMode, setFlexMode] = useFlexMode();
  const [, setFlexModeAssets] = useFlexModeAssets();
  const { portfolio } = useFlexPortfolio();
  const { getPrice } = useFlexModePrices();

  const [draft, setDraft] = useState<DraftState | null>(null);

  const fiatUnit = counterValueCurrency.units[0];

  // Reads through `buildFlexPortfolio` (via useFlexPortfolio) rather than raw settings,
  // so the page shows exactly the resolved values — defaults included — that the rest
  // of the app displays. `portfolio.assets` is already sorted by fiat value, descending.
  const sortedAssets = portfolio.assets;

  // Auto-sort is suspended while a field is being edited, otherwise a row could
  // reorder underneath the cursor on every keystroke.
  const displayedAssets = useMemo<readonly FlexAsset[]>(() => {
    if (!draft) return sortedAssets;
    const byId = new Map(sortedAssets.map(asset => [asset.currencyId, asset]));
    const ordered = draft.order
      .map(id => byId.get(id))
      .filter((asset): asset is FlexAsset => asset !== undefined);
    const missing = sortedAssets.filter(asset => !draft.order.includes(asset.currencyId));
    return [...ordered, ...missing];
  }, [sortedAssets, draft]);

  const persist = useCallback(
    (currencyId: string, amount: BigNumber, fiatValue: BigNumber) => {
      // Only the edited row and rows that were already explicit get written.
      // Auto-included rows stay auto so they keep tracking real holdings —
      // editing one asset must not silently freeze all the others.
      const entries = sortedAssets
        .filter(asset => asset.currencyId === currencyId || !asset.isAuto)
        .map(asset =>
          asset.currencyId === currencyId
            ? ([
                currencyId,
                {
                  amount: amount.decimalPlaces(MAX_AMOUNT_DECIMALS).toFixed(),
                  fiatValue: fiatValue.decimalPlaces(MAX_FIAT_DECIMALS).toFixed(),
                },
              ] as const)
            : ([
                asset.currencyId,
                { amount: asset.amount.toFixed(), fiatValue: asset.fiatValue.toFixed() },
              ] as const),
        );

      setFlexModeAssets(Object.fromEntries(entries) as FlexModeAssetsSettings);
    },
    [sortedAssets, setFlexModeAssets],
  );

  const formatNumber = useCallback(
    (value: BigNumber, maxDecimals: number) =>
      value.toNumber().toLocaleString(locale, { maximumFractionDigits: maxDecimals }),
    [locale],
  );

  const handleChange = useCallback(
    (currencyId: string, field: EditableField, raw: string) => {
      setDraft(current => ({
        currencyId,
        field,
        raw,
        order: current?.order ?? sortedAssets.map(asset => asset.currencyId),
      }));

      const parsed = parseFlexAmountInput(raw);
      if (parsed === undefined) return;

      // Prefer the live market price, but fall back to the rate the row's own
      // values already imply — the only rate that stays self-consistent for an
      // auto-included asset, or when prices haven't loaded.
      const asset = sortedAssets.find(a => a.currencyId === currencyId);
      const livePrice = getPrice(currencyId);
      const price =
        livePrice.isGreaterThan(0) && !asset?.isAuto
          ? livePrice
          : ((asset && impliedFlexPrice(asset)) ?? livePrice);

      if (field === "amount") {
        persist(currencyId, parsed, fiatValueFromAmount(parsed, price));
      } else {
        persist(currencyId, amountFromFiatValue(parsed, price), parsed);
      }
    },
    [getPrice, persist, sortedAssets],
  );

  // Dropping the draft on blur re-formats the edited field and re-enables auto-sort.
  const clearDraft = useCallback(() => setDraft(null), []);

  const assets = useMemo<FlexModeAssetRow[]>(
    () =>
      displayedAssets.map(asset => {
        const currency = findCryptoCurrencyById(asset.currencyId);
        const isDrafting = draft?.currencyId === asset.currencyId;
        return {
          currencyId: asset.currencyId,
          ticker: asset.ticker,
          name: currency?.name ?? asset.ticker,
          currency,
          amountText:
            isDrafting && draft.field === "amount"
              ? draft.raw
              : formatNumber(asset.amount, MAX_AMOUNT_DECIMALS),
          fiatText:
            isDrafting && draft.field === "fiatValue"
              ? draft.raw
              : formatNumber(asset.fiatValue, MAX_FIAT_DECIMALS),
          isAuto: asset.isAuto === true,
          onAmountChange: (raw: string) => handleChange(asset.currencyId, "amount", raw),
          onFiatChange: (raw: string) => handleChange(asset.currencyId, "fiatValue", raw),
          onBlur: clearDraft,
        };
      }),
    [displayedAssets, draft, formatNumber, handleChange, clearDraft],
  );

  // Preserves the portfolio-total number animation used on the dashboard.
  const animatedTotal = useAnimatedNumber(toBaseUnits(portfolio.totalFiat, fiatUnit).toNumber());
  const formattedTotal = formatCurrencyUnit(fiatUnit, new BigNumber(animatedTotal), {
    showCode: true,
    locale,
  });

  const onReset = useCallback(() => {
    setFlexModeAssets({});
    setDraft(null);
  }, [setFlexModeAssets]);

  // Auto-included rows are never "custom" — they track real holdings until edited,
  // and resetting can't change them, so they must not enable the reset button.
  const hasCustomValues = useMemo(() => {
    const defaults = new Map(
      buildFlexPortfolio({}).assets.map(asset => [asset.currencyId, asset] as const),
    );
    return portfolio.assets.some(asset => {
      if (asset.isAuto) return false;
      const fallback = defaults.get(asset.currencyId);
      return (
        fallback === undefined ||
        !fallback.amount.isEqualTo(asset.amount) ||
        !fallback.fiatValue.isEqualTo(asset.fiatValue)
      );
    });
  }, [portfolio]);

  return {
    t,
    flexMode,
    setFlexMode,
    assets,
    formattedTotal,
    fiatTicker: counterValueCurrency.ticker,
    onReset,
    hasCustomValues,
  };
}
