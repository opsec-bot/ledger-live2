import { useTranslation } from "react-i18next";
import { useSelector } from "LLD/hooks/redux";
import { flexModeSelector } from "~/renderer/reducers/settings";

export function useFlexModeBannerViewModel() {
  const { t } = useTranslation();
  const isActive = useSelector(flexModeSelector);

  return {
    isActive,
    label: t("settings.flexMode.banner"),
  };
}
