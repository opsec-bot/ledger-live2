import { useMemo } from "react";
import { formatCurrencyUnitFragment } from "@ledgerhq/live-common/currencies/index";
import type { Unit } from "@domain/entity-currency-unit";
import { BigNumber } from "bignumber.js";
import { useSelector } from "LLD/hooks/redux";
import { parseCurrencyUnitFragment } from "LLD/features/AssetDetail/utils/parseCurrencyUnitFragment";
import {
  discreetModeSelector,
  localeSelector,
  flexModeSelector,
  flexModeTargetUsdSelector,
} from "~/renderer/reducers/settings";
import { getFlexAssetBaseUnits } from "LLD/utils/flexMode";

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
  const flexMode = useSelector(flexModeSelector);
  const flexModeTargetUsd = useSelector(flexModeTargetUsdSelector);

  return useMemo(() => {
    const flexAmount = flexMode
      ? getFlexAssetBaseUnits(cryptoUnit.code, flexModeTargetUsd, cryptoUnit)
      : undefined;
    const fragment = formatCurrencyUnitFragment(
      cryptoUnit,
      flexAmount ?? new BigNumber(amount),
      {
        locale,
        discreet,
        showCode: true,
      },
    );
    return parseCurrencyUnitFragment(fragment);
  }, [amount, cryptoUnit, locale, discreet, flexMode, flexModeTargetUsd]);
}
