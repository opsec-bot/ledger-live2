import { useMemo } from "react";
import { BigNumber } from "bignumber.js";
import { createSelector } from "reselect";
import type { CryptoOrTokenCurrency } from "@domain/entity-currency";
import { getAccountCurrency } from "@ledgerhq/live-common/account/helpers";
import { useSelector } from "LLD/hooks/redux";
import { flattenAccountsSelector } from "~/renderer/reducers/accounts";
import {
  counterValueCurrencySelector,
  flexModeSelector,
  flexModeAssetsSelector,
} from "~/renderer/reducers/settings";
import { useCalculateCountervalueCallback } from "~/renderer/actions/general";
import {
  buildFlexPortfolio,
  computeFlexShare,
  findFlexAsset,
  scaleFlexAsset,
  EMPTY_FLEX_PORTFOLIO,
  type FlexAsset,
  type FlexAssetRef,
  type FlexPortfolio,
  type HeldAsset,
} from "LLD/utils/flexMode";

type CurrencyTotal = {
  readonly currency: CryptoOrTokenCurrency;
  balance: BigNumber;
};

/**
 * Total real balance per currency, in base units.
 *
 * Two jobs: working out what fraction of an asset's display value belongs to a
 * single account row, and knowing which currencies the user holds so they can be
 * auto-included in the display portfolio. The real balances are never displayed
 * while Flex Mode is on.
 */
const realBalanceByCurrencyIdSelector = createSelector(flattenAccountsSelector, accounts => {
  const totals = new Map<string, CurrencyTotal>();
  for (const account of accounts) {
    const currency = getAccountCurrency(account);
    const existing = totals.get(currency.id);
    if (existing) {
      existing.balance = existing.balance.plus(account.balance);
      continue;
    }
    totals.set(currency.id, { currency, balance: new BigNumber(account.balance) });
  }
  return totals;
});

export interface FlexModeDisplayModel {
  /** Whether Flex Mode is on. When false, `portfolio` is empty and every lookup returns undefined. */
  readonly enabled: boolean;
  /** The complete display portfolio: per-asset amounts/fiat values plus the derived total. */
  readonly portfolio: FlexPortfolio;
  /** The whole asset's display value — for screens that render one row per currency. */
  readonly findAsset: (ref: FlexAssetRef) => FlexAsset | undefined;
  /**
   * The display value apportioned to one row, given the real balance that row
   * represents — for screens that render one row per account. Pass the same
   * balance the row would otherwise display.
   */
  readonly resolveAsset: (
    ref: FlexAssetRef,
    realBalance: BigNumber | number,
  ) => FlexAsset | undefined;
}

/**
 * The single Flex Mode abstraction every display hook consumes. It never writes
 * anything and never touches transaction data, so it is safe to call from any
 * display-only view model.
 */
export function useFlexPortfolio(): FlexModeDisplayModel {
  const enabled = useSelector(flexModeSelector);
  const assets = useSelector(flexModeAssetsSelector);
  const realBalanceByCurrencyId = useSelector(realBalanceByCurrencyIdSelector);
  const counterValueCurrency = useSelector(counterValueCurrencySelector);
  const calculateCountervalue = useCalculateCountervalueCallback();

  const fiatMagnitude = counterValueCurrency.units[0].magnitude;

  // Everything the user holds that has no explicit Flex Mode entry, so it can be
  // scaled up rather than displaying its real value.
  const heldAssets = useMemo<HeldAsset[]>(() => {
    if (!enabled) return [];

    return [...realBalanceByCurrencyId.values()].reduce<HeldAsset[]>((acc, entry) => {
      const realCountervalue = calculateCountervalue(entry.currency, entry.balance);
      if (realCountervalue == null) return acc;

      acc.push({
        currencyId: entry.currency.id,
        ticker: entry.currency.ticker,
        amount: entry.balance.div(new BigNumber(10).pow(entry.currency.units[0].magnitude)),
        fiatValue: new BigNumber(realCountervalue).div(new BigNumber(10).pow(fiatMagnitude)),
      });
      return acc;
    }, []);
  }, [enabled, realBalanceByCurrencyId, calculateCountervalue, fiatMagnitude]);

  const portfolio = useMemo(
    () => (enabled ? buildFlexPortfolio(assets, heldAssets) : EMPTY_FLEX_PORTFOLIO),
    [enabled, assets, heldAssets],
  );

  return useMemo(() => {
    const findAsset = (ref: FlexAssetRef) => (enabled ? findFlexAsset(portfolio, ref) : undefined);

    return {
      enabled,
      portfolio,
      findAsset,
      resolveAsset: (ref, realBalance) => {
        const asset = findAsset(ref);
        if (!asset) return undefined;
        const share = computeFlexShare(
          new BigNumber(realBalance),
          realBalanceByCurrencyId.get(asset.currencyId)?.balance ?? new BigNumber(0),
        );
        return scaleFlexAsset(asset, share);
      },
    };
  }, [enabled, portfolio, realBalanceByCurrencyId]);
}
