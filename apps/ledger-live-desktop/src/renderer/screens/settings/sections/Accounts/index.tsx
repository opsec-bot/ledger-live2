import React from "react";
import { useTranslation } from "react-i18next";
import { Routes, Route } from "react-router";
import TrackPage from "~/renderer/analytics/TrackPage";
import { SettingsSectionRow as Row, SettingsSectionBody as Body } from "../../SettingsSection";
import HideEmptyTokenAccountsToggle from "./HideEmptyTokenAccountsToggle";
import FlexModeToggle from "./FlexModeToggle";
import FlexModeSettingsScreen from "./FlexMode/FlexModeSettingsScreen";
import FilterTokenOperationsZeroAmount from "./FilterTokenOperationsZeroAmount";
import SectionExport from "./Export";
import Currencies from "./Currencies";
import BlacklistedTokens from "./BlacklistedTokens";
import DoNotAskAgainSkipMemo from "./DoNotAskAgainSkipMemo";
import { useWalletFeaturesConfig } from "@features/platform-feature-flags";

function Default() {
  const { t } = useTranslation();
  const { shouldDisplayOperationsList } = useWalletFeaturesConfig("desktop");

  return (
    <Body>
      <TrackPage category="Settings" name="Accounts" />
      {shouldDisplayOperationsList ? null : <SectionExport />}
      <Row
        title={t("settings.accounts.hideEmptyTokens.title")}
        desc={t("settings.accounts.hideEmptyTokens.desc")}
      >
        <HideEmptyTokenAccountsToggle />
      </Row>
      <Row title={t("settings.flexMode.title")} desc={t("settings.flexMode.desc")}>
        <FlexModeToggle />
      </Row>
      <FilterTokenOperationsZeroAmount />
      <DoNotAskAgainSkipMemo />
      <BlacklistedTokens />
      <Currencies />
    </Body>
  );
}

export default function SectionAccounts() {
  return (
    <Routes>
      <Route path="flex-mode" element={<FlexModeSettingsScreen />} />
      <Route path="*" element={<Default />} />
    </Routes>
  );
}
