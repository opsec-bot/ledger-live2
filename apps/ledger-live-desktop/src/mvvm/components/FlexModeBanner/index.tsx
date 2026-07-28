import React from "react";
import { useFlexModeBannerViewModel } from "./useFlexModeBannerViewModel";

export function FlexModeBanner() {
  const { isActive, label } = useFlexModeBannerViewModel();

  if (!isActive) return null;

  return (
    <div
      data-testid="flex-mode-banner"
      className="flex w-full items-center justify-center bg-amber-500 py-4 text-center text-12 font-semibold uppercase tracking-wide text-black"
    >
      {label}
    </div>
  );
}
