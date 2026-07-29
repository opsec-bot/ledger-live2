import type { Currency } from "@domain/entity-currency";
import { BigNumber } from "bignumber.js";
import { formatCurrencyUnit } from "@ledgerhq/live-common/currencies/index";
import { useSelector } from "LLD/hooks/redux";
import {
  localeSelector,
  discreetModeSelector,
  flexModeSelector,
  flexModeTargetUsdSelector,
} from "~/renderer/reducers/settings";
import { getFlexAssetBaseUnits } from "LLD/utils/flexMode";

export function useBalanceCellViewModel(
  currency: Currency,
  balance: BigNumber | number,
  options?: { alwaysShowSign?: boolean },
) {
  const locale = useSelector(localeSelector);
  const discreet = useSelector(discreetModeSelector);
  const flexMode = useSelector(flexModeSelector);
  const flexModeTargetUsd = useSelector(flexModeTargetUsdSelector);

  const realBigNumberBalance = typeof balance === "number" ? new BigNumber(balance) : balance;
  const flexBalance = flexMode
    ? getFlexAssetBaseUnits(currency.units[0].code, flexModeTargetUsd, currency.units[0])
    : undefined;
  const bigNumberBalance = flexBalance ?? realBigNumberBalance;

  const formattedBalance = formatCurrencyUnit(currency.units[0], bigNumberBalance, {
    showCode: true,
    alwaysShowSign: options?.alwaysShowSign,
    locale,
    discreet,
  });

  return { formattedBalance };
}
