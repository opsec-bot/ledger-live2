import type { Currency } from "@domain/entity-currency";
import { BigNumber } from "bignumber.js";
import { formatCurrencyUnit } from "@ledgerhq/live-common/currencies/index";
import { useCalculate } from "@ledgerhq/live-countervalues-react";
import { useSelector } from "LLD/hooks/redux";
import {
  counterValueCurrencySelector,
  localeSelector,
  discreetModeSelector,
} from "~/renderer/reducers/settings";
import { toBaseUnits, flexAssetRefFromCurrency } from "LLD/utils/flexMode";
import { useFlexPortfolio } from "LLD/hooks/useFlexPortfolio";

export function useCounterValueCellViewModel(
  currency: Currency,
  value: BigNumber | number,
  options?: { date?: Date; alwaysShowSign?: boolean },
) {
  const counterValueCurrency = useSelector(counterValueCurrencySelector);
  const locale = useSelector(localeSelector);
  const discreet = useSelector(discreetModeSelector);
  const { resolveAsset } = useFlexPortfolio();

  const numericValue = typeof value === "number" ? value : value.toNumber();

  const counterValue = useCalculate({
    from: currency,
    to: counterValueCurrency,
    value: numericValue,
    disableRounding: true,
    date: options?.date,
  });

  // Keeps the fiat column consistent with the crypto amount BalanceCell renders
  // for the same row, and with the Flex Mode portfolio total those rows sum to.
  const flexAsset = resolveAsset(flexAssetRefFromCurrency(currency), numericValue);
  const fiatUnit = counterValueCurrency.units[0];

  if (flexAsset) {
    return {
      formattedCounterValue: formatCurrencyUnit(
        fiatUnit,
        toBaseUnits(flexAsset.fiatValue, fiatUnit),
        {
          showCode: true,
          alwaysShowSign: options?.alwaysShowSign,
          locale,
          discreet,
        },
      ),
    };
  }

  if (typeof counterValue !== "number") {
    return { formattedCounterValue: "-" };
  }

  const formattedCounterValue = formatCurrencyUnit(fiatUnit, new BigNumber(counterValue), {
    showCode: true,
    alwaysShowSign: options?.alwaysShowSign,
    locale,
    discreet,
  });

  return { formattedCounterValue };
}
