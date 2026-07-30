import { useCallback } from "react";
import { useSelector } from "LLD/hooks/redux";
import {
  hasOnboardedDeviceSelector,
  localeSelector,
  discreetModeSelector,
} from "~/renderer/reducers/settings";
import { toBaseUnits, FLEX_MODE_VALUE_CHANGE_PERCENTAGE } from "LLD/utils/flexMode";
import { useFlexPortfolio } from "LLD/hooks/useFlexPortfolio";
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
  const { enabled: flexMode, portfolio: flexPortfolio } = useFlexPortfolio();
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

  // The Flex Mode total is always the sum of the per-asset display values the user configured.
  const flexFiatTotal = flexMode ? toBaseUnits(flexPortfolio.totalFiat, unit).toNumber() : null;
  // Eases from the last real/flex value to the new one whenever flexFiatTotal changes
  // (toggling Flex Mode on/off, or editing an asset's amount) instead of jumping instantly.
  const animatedFlexBalance = useAnimatedNumber(flexFiatTotal ?? realDisplayedBalance);
  const displayedBalance = flexMode ? animatedFlexBalance : realDisplayedBalance;
  // Flex Mode shows its fake numbers even before any real account has synced.
  const balanceAvailable = flexMode ? true : realBalanceAvailable;
  const valueChange = flexMode
    ? {
        percentage: FLEX_MODE_VALUE_CHANGE_PERCENTAGE,
        value: displayedBalance * FLEX_MODE_VALUE_CHANGE_PERCENTAGE,
      }
    : realValueChange;

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
