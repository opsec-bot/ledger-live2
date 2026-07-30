import type { Currency } from "@domain/entity-currency";
import { BigNumber } from "bignumber.js";
import { formatCurrencyUnit } from "@ledgerhq/live-common/currencies/index";
import { useSelector } from "LLD/hooks/redux";
import { localeSelector, discreetModeSelector } from "~/renderer/reducers/settings";
import { toBaseUnits, flexAssetRefFromCurrency } from "LLD/utils/flexMode";
import { useFlexPortfolio } from "LLD/hooks/useFlexPortfolio";

export function useBalanceCellViewModel(
  currency: Currency,
  balance: BigNumber | number,
  options?: { alwaysShowSign?: boolean },
) {
  const locale = useSelector(localeSelector);
  const discreet = useSelector(discreetModeSelector);
  const { resolveAsset } = useFlexPortfolio();

  const realBigNumberBalance = typeof balance === "number" ? new BigNumber(balance) : balance;
  // Apportioned, so a per-account row shows its share rather than the whole asset.
  const flexAsset = resolveAsset(flexAssetRefFromCurrency(currency), realBigNumberBalance);
  const bigNumberBalance = flexAsset
    ? toBaseUnits(flexAsset.amount, currency.units[0])
    : realBigNumberBalance;

  const formattedBalance = formatCurrencyUnit(currency.units[0], bigNumberBalance, {
    showCode: true,
    alwaysShowSign: options?.alwaysShowSign,
    locale,
    discreet,
  });

  return { formattedBalance };
}
