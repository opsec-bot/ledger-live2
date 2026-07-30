import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useSelector } from "LLD/hooks/redux";
import {
  hideEmptyTokenAccountsSelector,
  blacklistedTokenIdsSelector,
} from "~/renderer/reducers/settings";
import { useDistribution } from "~/renderer/actions/general";
import { useWalletFeaturesConfig } from "@features/platform-feature-flags";
import { setTrackingSource } from "~/renderer/analytics/TrackPage";
import { useFlexPortfolio } from "LLD/hooks/useFlexPortfolio";
import { flexAssetRefFromCurrency, flexDistributionPercentage } from "LLD/utils/flexMode";
import type { AllocationTableItem, AllocationViewProps } from "../types";

const PAGE_SIZE = 6;

export function useAllocationData(): AllocationViewProps {
  const navigate = useNavigate();
  const { shouldDisplayAggregatedAssets } = useWalletFeaturesConfig("desktop");
  const hideEmptyTokenAccount = useSelector(hideEmptyTokenAccountsSelector);
  const blacklistedTokenIds = useSelector(blacklistedTokenIdsSelector);

  const distribution = useDistribution({
    hideEmptyTokenAccount,
    groupBy: shouldDisplayAggregatedAssets ? "asset" : undefined,
  });

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { enabled: flexMode, portfolio: flexPortfolio, findAsset } = useFlexPortfolio();

  const allItems: AllocationTableItem[] = useMemo(
    () =>
      distribution.list
        .filter(item => !blacklistedTokenIds.includes(item.currency.id))
        .map(item => {
          // Percentages have to come from the display portfolio too, otherwise the
          // allocation column reports real weights next to Flex Mode balances.
          const flexAsset = findAsset(flexAssetRefFromCurrency(item.currency));
          const distributionPercentage = flexAsset
            ? flexDistributionPercentage(flexPortfolio, flexAsset)
            : (item.distribution ?? 0) * 100;
          return {
            currency: item.currency,
            balance: item.amount,
            distribution: Math.floor(distributionPercentage * 100) / 100,
          };
        }),
    [distribution.list, blacklistedTokenIds, flexPortfolio, findAsset],
  );

  // Flex Mode's own assets lead the list, ordered by their display value.
  const orderedItems = useMemo(() => {
    if (!flexMode) return allItems;
    const rank = new Map(flexPortfolio.assets.map((asset, index) => [asset.currencyId, index]));
    return [...allItems].sort(
      (a, b) =>
        (rank.get(a.currency.id) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.currency.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [allItems, flexMode, flexPortfolio]);

  const items = useMemo(() => orderedItems.slice(0, visibleCount), [orderedItems, visibleCount]);
  const hasMore = visibleCount < orderedItems.length;

  const showMore = useCallback(() => {
    setVisibleCount(prev => prev + PAGE_SIZE);
  }, []);

  const onItemClick = useCallback(
    (item: AllocationTableItem) => {
      setTrackingSource("asset allocation");
      navigate(`/asset/${item.currency.id}`);
    },
    [navigate],
  );

  return { items, hasMore, showMore, onItemClick };
}
