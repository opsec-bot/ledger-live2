import { useCallback } from "react";
import { BigNumber } from "bignumber.js";
import type { CalculateCountervalue } from "@ledgerhq/asset-aggregation/index";
import { useCalculateCountervalueCallback } from "~/renderer/actions/general";
import { useSelector } from "LLD/hooks/redux";
import { counterValueCurrencySelector } from "~/renderer/reducers/settings";
import { toBaseUnits, flexAssetRefFromCurrency } from "LLD/utils/flexMode";
import { useFlexPortfolio } from "LLD/hooks/useFlexPortfolio";

/**
 * A countervalue callback that returns Flex Mode display values for customised
 * assets and real countervalues for everything else.
 *
 * Injecting at this level keeps everything derived from a countervalue —
 * aggregated account totals, balance sort order — consistent with the per-row
 * values the cells render, instead of each aggregation re-deriving real numbers.
 */
export function useFlexCalculateCountervalue(): CalculateCountervalue {
  const calculateCountervalue = useCalculateCountervalueCallback();
  const counterValueCurrency = useSelector(counterValueCurrencySelector);
  const { resolveAsset } = useFlexPortfolio();

  const fiatUnit = counterValueCurrency.units[0];

  return useCallback<CalculateCountervalue>(
    (from, value) => {
      const flexAsset = resolveAsset(flexAssetRefFromCurrency(from), value);
      if (flexAsset) return toBaseUnits(flexAsset.fiatValue, fiatUnit);
      return calculateCountervalue(from, new BigNumber(value));
    },
    [resolveAsset, fiatUnit, calculateCountervalue],
  );
}
