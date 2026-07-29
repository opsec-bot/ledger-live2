import { useCallback } from "react";
import { useSelector } from "LLD/hooks/redux";
import {
  hasOnboardedDeviceSelector,
  localeSelector,
  discreetModeSelector,
  flexModeSelector,
  flexModeTargetUsdSelector,
} from "~/renderer/reducers/settings";
import { getFlexModeFiatBaseUnits } from "LLD/utils/flexMode";
import { useAnimatedNumber } from "LLD/hooks/useAnimatedNumber";
import { themeSelector } from "~/renderer/actions/general";
import { useAccountStatus } from "LLD/hooks/useAccountStatus";
import { usePortfolioBalanceDisplayState } from "LLD/hooks/usePortfolioBalanceDisplayState";
import { BalanceViewModelResult } from "../components/Balance/types";
import { formatCurrencyUnitFragment } from "@ledgerhq/live-common/currencies/index";
import type { FormattedValue } from "@ledgerhq/lumen-ui-react";
import { useNavigate } from "react-router";
import BigNumber from "bignumber.js";
import { track } from "~/renderer/analytics/segment";
import { PORTFOLIO_TRACKING_PAGE_NAME } from "LLD/utils/constants";
import { setTrackingSource } from "~/renderer/analytics/TrackPage";

interface UseBalanceViewModelOptions {
  readonly legacyRange?: boolean;
}

export const useBalanceViewModel = (
  options: UseBalanceViewModelOptions = {},
): BalanceViewModelResult => {
  const navigate = useNavigate();
  const locale = useSelector(localeSelector);
  const discreet = useSelector(discreetModeSelector);
  const flexMode = useSelector(flexModeSelector);
  const flexModeTargetUsd = useSelector(flexModeTargetUsdSelector);
  const hasOnboardedDevice = useSelector(hasOnboardedDeviceSelector);
  const theme = useSelector(themeSelector);
  const { hasAccount } = useAccountStatus();

  const {
    counterValue,
    displayedBalance: realDisplayedBalance,
    balanceAvailable: realBalanceAvailable,
    isLoading,
    isColdStart,
    valueChange: realValueChange,
  } = usePortfolioBalanceDisplayState(options);

  const unit = counterValue.units[0];

  const flexFiatTarget = flexMode ? getFlexModeFiatBaseUnits(flexModeTargetUsd, unit).toNumber() : null;
  // Eases from the last real/flex value to the new one whenever flexFiatTarget changes
  // (toggling Flex Mode on/off, or switching target-amount presets) instead of jumping instantly.
  const animatedFlexBalance = useAnimatedNumber(flexFiatTarget ?? realDisplayedBalance);
  const displayedBalance = flexMode ? animatedFlexBalance : realDisplayedBalance;
  // Flex Mode shows its fake numbers even before any real account has synced.
  const balanceAvailable = flexMode ? true : realBalanceAvailable;
  // Flex Mode always shows a modest fake uptick rather than mirroring the real trend.
  const valueChange = flexMode ? { percentage: 0.021, value: displayedBalance * 0.021 } : realValueChange;

  const navigateToAnalytics = useCallback(() => {
    setTrackingSource(PORTFOLIO_TRACKING_PAGE_NAME);
    track("button_clicked", {
      button: "analytics_page",
      page: PORTFOLIO_TRACKING_PAGE_NAME,
    });
    navigate("/analytics");
  }, [navigate]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        navigateToAnalytics();
      }
    },
    [navigateToAnalytics],
  );

  const formatter = useCallback(
    (value: number): FormattedValue =>
      formatCurrencyUnitFragment(unit, new BigNumber(value), {
        locale,
        showCode: true,
      }),
    [unit, locale],
  );

  return {
    balance: displayedBalance,
    balanceAvailable,
    formatter,
    discreet,
    valueChange,
    navigateToAnalytics,
    handleKeyDown,
    hasAccount,
    hasOnboardedDevice,
    isColdStart,
    isLoading,
    theme,
  };
};
