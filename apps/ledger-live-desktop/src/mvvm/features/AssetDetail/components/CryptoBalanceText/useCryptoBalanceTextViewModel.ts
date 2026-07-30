import { useMemo } from "react";
import { formatCurrencyUnitFragment } from "@ledgerhq/live-common/currencies/index";
import type { Unit } from "@domain/entity-currency-unit";
import { BigNumber } from "bignumber.js";
import { useSelector } from "LLD/hooks/redux";
import { parseCurrencyUnitFragment } from "LLD/features/AssetDetail/utils/parseCurrencyUnitFragment";
import { discreetModeSelector, localeSelector } from "~/renderer/reducers/settings";
import { toBaseUnits } from "LLD/utils/flexMode";
import { useFlexPortfolio } from "LLD/hooks/useFlexPortfolio";

type UseCryptoBalanceTextViewModelParams = Readonly<{
  amount: number;
  cryptoUnit: Unit;
}>;

export function useCryptoBalanceTextViewModel({
  amount,
  cryptoUnit,
}: UseCryptoBalanceTextViewModelParams) {
  const locale = useSelector(localeSelector);
  const discreet = useSelector(discreetModeSelector);
  const { findAsset } = useFlexPortfolio();

  // Only the unit is available here, so the asset is resolved by ticker.
  const flexAsset = findAsset({ ticker: cryptoUnit.code });

  return useMemo(() => {
    const displayedAmount = flexAsset
      ? toBaseUnits(flexAsset.amount, cryptoUnit)
      : new BigNumber(amount);
    const fragment = formatCurrencyUnitFragment(cryptoUnit, displayedAmount, {
      locale,
      discreet,
      showCode: true,
    });
    return parseCurrencyUnitFragment(fragment);
  }, [amount, cryptoUnit, locale, discreet, flexAsset]);
}
