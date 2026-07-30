import { useCallback, useMemo } from "react";
import { BigNumber } from "bignumber.js";
import { useAssetsData } from "@ledgerhq/live-common/dada-client/hooks/useAssetsData";
import { useUsdToFiatRate } from "@ledgerhq/live-common/counterValues/hooks/useUsdToFiatRate";
import { useSelector } from "LLD/hooks/redux";
import { counterValueCurrencySelector } from "~/renderer/reducers/settings";
import { FLEX_MODE_SUPPORTED_ASSETS } from "LLD/utils/flexMode";

const FLEX_MODE_PRICE_REFRESH_INTERVAL_MS = 60_000;

export interface FlexModePrices {
  /** Price of one unit of `currencyId` in the user's counter-value currency. */
  readonly getPrice: (currencyId: string) => BigNumber;
  /** False while falling back to the registry reference prices. */
  readonly isLive: boolean;
}

/**
 * Spot prices used only by the Flex Mode settings page, to keep the quantity and
 * fiat fields in sync while the user edits them. Display hooks never call this —
 * they read the values the user already committed to settings.
 *
 * Shares the same RTK Query cache key as the assets page, so this adds no extra
 * network traffic when both are mounted.
 */
export function useFlexModePrices(): FlexModePrices {
  const counterValueCurrency = useSelector(counterValueCurrencySelector);
  const { status: rateStatus, rate } = useUsdToFiatRate(counterValueCurrency.ticker);

  const { data: assetsData } = useAssetsData({
    product: "lld",
    version: __APP_VERSION__,
    pollingInterval: FLEX_MODE_PRICE_REFRESH_INTERVAL_MS,
    skipPollingIfUnfocused: true,
  });

  const usdPriceById = useMemo(() => {
    const map = new Map<string, number>();
    if (!assetsData?.markets) return map;
    for (const [currencyId, market] of Object.entries(assetsData.markets)) {
      if (market?.price != null) map.set(currencyId, market.price);
    }
    return map;
  }, [assetsData]);

  const usdToFiat = rateStatus === "ready" && rate != null ? rate : 1;
  const isLive = rateStatus === "ready" && rate != null && usdPriceById.size > 0;

  const getPrice = useCallback(
    (currencyId: string): BigNumber => {
      const livePriceUsd = usdPriceById.get(currencyId);
      if (livePriceUsd != null) return new BigNumber(livePriceUsd).times(usdToFiat);

      const fallback = FLEX_MODE_SUPPORTED_ASSETS.find(
        asset => asset.currencyId === currencyId,
      )?.referencePriceUsd;
      return new BigNumber(fallback ?? 0).times(usdToFiat);
    },
    [usdPriceById, usdToFiat],
  );

  return useMemo(() => ({ getPrice, isLive }), [getPrice, isLive]);
}
