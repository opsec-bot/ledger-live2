import React, { useCallback } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@ledgerhq/lumen-ui-react";
import { useFlexMode } from "~/renderer/actions/settings";
import Track from "~/renderer/analytics/Track";
import Switch from "~/renderer/components/Switch";
import Box from "~/renderer/components/Box";

export default function FlexModeToggle() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [flexMode, setFlexMode] = useFlexMode();

  const onConfigure = useCallback(() => {
    navigate("/settings/accounts/flex-mode");
  }, [navigate]);

  return (
    <Box horizontal alignItems="center" gap="12px">
      <Track onUpdate event={flexMode ? "flexModeEnabled" : "flexModeDisabled"} />
      <Button
        size="sm"
        appearance="no-background"
        onClick={onConfigure}
        data-testid="flex-mode-configure"
      >
        {t("settings.flexMode.configure")}
      </Button>
      <Switch isChecked={flexMode} onChange={setFlexMode} data-testid="flexMode" />
    </Box>
  );
}
