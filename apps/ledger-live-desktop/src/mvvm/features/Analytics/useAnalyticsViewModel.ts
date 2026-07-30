import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { useSelector } from "LLD/hooks/redux";
import {
  counterValueCurrencySelector,
  selectedTimeRangeSelector,
} from "~/renderer/reducers/settings";
import { accountsSelector } from "~/renderer/reducers/accounts";
import { useWalletFeaturesConfig } from "@features/platform-feature-flags";
import { usePortfolioBalanceDisplayState } from "LLD/hooks/usePortfolioBalanceDisplayState";
import { useCountervaluesState } from "@ledgerhq/live-countervalues-react";
import { resolveAnalyticsValueChange } from "@ledgerhq/wallet-analytics";
import { useFlexPortfolio } from "LLD/hooks/useFlexPortfolio";
import { useAnimatedNumber } from "LLD/hooks/useAnimatedNumber";
import {
  buildFlexBalanceHistory,
  projectFlexBalanceHistory,
  toBaseUnits,
  FLEX_MODE_VALUE_CHANGE_PERCENTAGE,
} from "LLD/utils/flexMode";
import type { AnalyticsViewModel } from "./types";

export default function useAnalyticsViewModel(): AnalyticsViewModel {
  const navigate = useNavigate();
  const counterValue = useSelector(counterValueCurrencySelector);
  const selectedTimeRange = useSelector(selectedTimeRangeSelector);
  const accounts = useSelector(accountsSelector);
  const cvState = useCountervaluesState();
  const { shouldDisplayAssetSection, shouldDisplayPnl: isPnlFlagOn } =
    useWalletFeaturesConfig("desktop");
  const {
    balanceInfo: syncBalanceInfo,
    portfolio: realPortfolio,
    isLoading,
  } = usePortfolioBalanceDisplayState({ legacyRange: true });
  const { enabled: flexMode, portfolio: flexPortfolio } = useFlexPortfolio();

  const shouldDisplayPnl = isPnlFlagOn && accounts.length > 0;

  const valueChange = useMemo(
    () =>
      resolveAnalyticsValueChange({
        selectedTimeRange,
        accounts,
        currentBalance: syncBalanceInfo.totalBalance,
        portfolio: realPortfolio,
        cvState,
        counterValue,
      }),
    [
      selectedTimeRange,
      accounts,
      syncBalanceInfo.totalBalance,
      realPortfolio,
      cvState,
      counterValue,
    ],
  );

  // The Analytics header and chart read the same display portfolio as the
  // dashboard, so the two screens can't disagree on the total.
  const flexTotal = flexMode
    ? toBaseUnits(flexPortfolio.totalFiat, counterValue.units[0]).toNumber()
    : null;
  const animatedFlexTotal = useAnimatedNumber(flexTotal ?? syncBalanceInfo.totalBalance);

  const portfolio = useMemo(() => {
    if (!flexMode) return realPortfolio;
    const fiatUnit = counterValue.units[0];
    return {
      ...realPortfolio,
      balanceHistory: realPortfolio.balanceHistory.length
        ? projectFlexBalanceHistory(flexPortfolio.totalFiat, fiatUnit, realPortfolio.balanceHistory)
        : buildFlexBalanceHistory(flexPortfolio.totalFiat, fiatUnit),
    };
  }, [flexMode, realPortfolio, flexPortfolio, counterValue]);

  const balanceInfo = useMemo(
    () =>
      flexMode
        ? {
            totalBalance: animatedFlexTotal,
            isAvailable: true,
            valueChange: {
              percentage: FLEX_MODE_VALUE_CHANGE_PERCENTAGE,
              value: animatedFlexTotal * FLEX_MODE_VALUE_CHANGE_PERCENTAGE,
            },
          }
        : { ...syncBalanceInfo, valueChange },
    [flexMode, animatedFlexTotal, syncBalanceInfo, valueChange],
  );

  const navigateToDashboard = useCallback(() => {
    navigate("/");
  }, [navigate]);

  return {
    navigateToDashboard,
    counterValue,
    selectedTimeRange,
    balanceInfo,
    portfolio,
    isLoading,
    shouldDisplayAssetSection,
    shouldDisplayPnl,
  };
}
