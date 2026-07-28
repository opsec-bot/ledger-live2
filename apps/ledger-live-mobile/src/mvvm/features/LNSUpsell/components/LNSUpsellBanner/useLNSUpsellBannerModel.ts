import { Image, Linking } from "react-native";
import { toLargeScreenUpsellDeviceModelAnalyticsValue } from "LLM/features/LargeScreenUpsell";
import { track } from "~/analytics";
import type { LNSBannerLocation, LNSBannerModel } from "../../types";
import { useLNSUpsellBannerState } from "../../hooks/useLNSUpsellBannerState";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const lnsUpsellFallbackImageUri = Image.resolveAssetSource(
  require("~/images/lns-upsell-banner.webp"),
).uri;

export function useLNSUpsellBannerModel(location: LNSBannerLocation): LNSBannerModel {
  const { isShown, ctaLink, deviceModelId, tracking } = useLNSUpsellBannerState(location);
  const analyticsPage = AnalyticsPageMap[location];
  const deviceModel = deviceModelId
    ? toLargeScreenUpsellDeviceModelAnalyticsValue(deviceModelId)
    : undefined;

  const handleCTAPress = () => {
    if (!ctaLink) return;

    track("button_clicked", {
      button: "Level up wallet",
      ...(deviceModel ? { deviceModel } : {}),
      link: ctaLink,
      page: analyticsPage,
    });
    Linking.openURL(ctaLink);
  };

  return {
    location,
    isShown,
    tracking,
    handleCTAPress,
    imageUrl: lnsUpsellFallbackImageUri,
  };
}

const AnalyticsPageMap = {
  manager: "Manager",
  accounts: "Accounts",
  notification_center: "NotificationPanel",
  wallet: "Wallet",
} as const satisfies Record<LNSBannerLocation, unknown>;
