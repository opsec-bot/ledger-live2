export type LNSBannerLocation = "manager" | "accounts" | "notification_center" | "wallet";

export type LNSBannerModel = {
  location: LNSBannerLocation;
  isShown: boolean;
  discount?: number;
  tracking: "opted_in" | "opted_out";
  handleCTAPress: () => void;
  imageUrl: string;
};
