import React, { useCallback, useMemo } from "react";
import { useFlexMode, useFlexModeTargetUsd } from "~/renderer/actions/settings";
import Track from "~/renderer/analytics/Track";
import Switch from "~/renderer/components/Switch";
import Select from "~/renderer/components/Select";
import Box from "~/renderer/components/Box";
import { FLEX_MODE_TARGET_PRESETS } from "LLD/utils/flexMode";

type TargetOption = { value: number; label: string };

export default function FlexModeToggle() {
  const [flexMode, setFlexMode] = useFlexMode();
  const [flexModeTargetUsd, setFlexModeTargetUsd] = useFlexModeTargetUsd();

  const targetOptions = useMemo<TargetOption[]>(
    () =>
      FLEX_MODE_TARGET_PRESETS.map(value => ({
        value,
        label: `$${value.toLocaleString("en-US")}`,
      })),
    [],
  );

  const currentTarget = targetOptions.find(o => o.value === flexModeTargetUsd) ?? targetOptions[1];

  const handleChangeTarget = useCallback(
    (option?: TargetOption | null) => {
      if (option) setFlexModeTargetUsd(option.value);
    },
    [setFlexModeTargetUsd],
  );

  return (
    <Box horizontal alignItems="center" gap="12px">
      <Track onUpdate event={flexMode ? "flexModeEnabled" : "flexModeDisabled"} />
      {flexMode && (
        <Select
          small
          minWidth={140}
          isSearchable={false}
          onChange={handleChangeTarget}
          renderValue={({ data }) => data?.label}
          value={currentTarget}
          options={targetOptions}
        />
      )}
      <Switch isChecked={flexMode} onChange={setFlexMode} data-testid="flexMode" />
    </Box>
  );
}
