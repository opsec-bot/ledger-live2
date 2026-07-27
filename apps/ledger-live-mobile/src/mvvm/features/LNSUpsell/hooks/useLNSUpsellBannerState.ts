import { useSelector } from "~/context/hooks";
import { useFeature } from "@features/platform-feature-flags";
import type { Features } from "@shared/feature-flags";
import {
  useLargeScreenUpsellEligibility,
  type LargeScreenUpsellNanoDeviceModelId,
} from "LLM/features/LargeScreenUpsell";
import useDynamicContent from "~/dynamicContent/useDynamicContent";
import { personalizedRecommendationsEnabledSelector } from "~/reducers/settings";
import type { LNSBannerLocation } from "../types";

type LNSUpsellBannerState = {
  isShown: boolean;
  ctaLink?: string;
  deviceModelId?: LargeScreenUpsellNanoDeviceModelId;
  tracking: "opted_in" | "opted_out";
};

type LargeScreenUpsellParams = NonNullable<Features["largeScreenUpsell"]["params"]>;
type LargeScreenUpsellBannerPlacement = keyof LargeScreenUpsellParams["banners"];

const LARGE_SCREEN_UPSELL_BANNER_PLACEMENT_BY_LOCATION = {
  manager: "my-ledger",
  accounts: "accounts",
  notification_center: "notification-center",
  wallet: "homepage",
} as const satisfies Record<LNSBannerLocation, LargeScreenUpsellBannerPlacement>;

const LNS_UPSELL_HIGH_TIER = "LNS_UPSELL_HIGH_TIER";

export function useLNSUpsellBannerState(location: LNSBannerLocation): LNSUpsellBannerState {
  const isOptIn = useSelector(personalizedRecommendationsEnabledSelector);
  const largeScreenUpsell = useFeature("largeScreenUpsell");
  const eligibility = useLargeScreenUpsellEligibility();
  const tracking = isOptIn ? "opted_in" : "opted_out";
  const ctaLink = largeScreenUpsell?.params?.[tracking].link;
  const placement = LARGE_SCREEN_UPSELL_BANNER_PLACEMENT_BY_LOCATION[location];
  const isPlacementEnabled = largeScreenUpsell?.params?.banners?.[placement] ?? true;

  const { mobileCards } = useDynamicContent();
  const isExcluded = isOptIn && mobileCards.some(c => c.extras.campaign === LNS_UPSELL_HIGH_TIER);

  const isShown = eligibility.isEligible && isPlacementEnabled && !isExcluded;
  const deviceModelId = eligibility.isEligible ? eligibility.deviceModelId : undefined;

  return { isShown, ctaLink, deviceModelId, tracking };
}
