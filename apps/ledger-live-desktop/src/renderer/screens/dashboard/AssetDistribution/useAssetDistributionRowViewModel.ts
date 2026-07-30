import { BigNumber } from "bignumber.js";
import type { DistributionItem } from "@ledgerhq/types-live";
import { useSelector } from "LLD/hooks/redux";
import { counterValueCurrencySelector } from "~/renderer/reducers/settings";
import { useFlexPortfolio } from "LLD/hooks/useFlexPortfolio";
import {
  flexAssetRefFromCurrency,
  flexDistributionPercentage,
  toBaseUnits,
} from "LLD/utils/flexMode";

export type AssetDistributionRowViewModel = {
  /** Crypto amount to render, in the currency's smallest unit. */
  readonly amount: BigNumber | number;
  /**
   * Fiat value to render, in the counter-value currency's smallest unit.
   * Set only when Flex Mode overrides this row — otherwise the real
   * countervalue is calculated by the CounterValue component as usual.
   */
  readonly fiatBaseUnits?: BigNumber;
  /** Share of the portfolio, 0–100. */
  readonly percentage: number;
};

/**
 * The dashboard's asset allocation rows render amount, fiat value and share
 * independently, so all three have to come from the same source — otherwise
 * Flex Mode's headline total sits above rows still showing real holdings.
 */
export function useAssetDistributionRowViewModel(
  item: DistributionItem,
): AssetDistributionRowViewModel {
  const counterValueCurrency = useSelector(counterValueCurrencySelector);
  const { portfolio, resolveAsset } = useFlexPortfolio();

  const flexAsset = resolveAsset(flexAssetRefFromCurrency(item.currency), item.amount);

  if (!flexAsset) {
    return { amount: item.amount, percentage: Math.floor(item.distribution * 10000) / 100 };
  }

  return {
    amount: toBaseUnits(flexAsset.amount, item.currency.units[0]),
    fiatBaseUnits: toBaseUnits(flexAsset.fiatValue, counterValueCurrency.units[0]),
    percentage:
      Math.floor(flexDistributionPercentage(portfolio, flexAsset) * 100) / 100,
  };
}
