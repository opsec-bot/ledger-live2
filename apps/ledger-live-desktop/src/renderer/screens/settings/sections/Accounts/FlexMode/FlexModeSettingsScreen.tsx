import React from "react";
import { useNavigate } from "react-router";
import { Button, Switch, TextInput } from "@ledgerhq/lumen-ui-react";
import { ArrowLeft } from "@ledgerhq/lumen-ui-react/symbols";
import CryptoCurrencyIcon from "~/renderer/components/CryptoCurrencyIcon";
import TrackPage from "~/renderer/analytics/TrackPage";
import {
  useFlexModeSettingsViewModel,
  type FlexModeAssetRow,
} from "./useFlexModeSettingsViewModel";

function AssetRow({
  asset,
  fiatTicker,
  amountLabel,
  valueLabel,
  autoLabel,
  disabled,
}: {
  asset: FlexModeAssetRow;
  fiatTicker: string;
  amountLabel: string;
  valueLabel: string;
  autoLabel: string;
  disabled: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-12 rounded-lg bg-surface p-16"
      data-testid={`flex-mode-asset-${asset.currencyId}`}
    >
      <div className="flex items-center gap-12">
        {asset.currency ? <CryptoCurrencyIcon currency={asset.currency} size={32} /> : null}
        <div className="flex min-w-0 flex-col">
          <span className="body-2-semi-bold truncate text-base">{asset.name}</span>
          <span className="body-3 text-muted">
            {asset.isAuto ? `${asset.ticker} · ${autoLabel}` : asset.ticker}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-12 sm:grid-cols-2">
        <TextInput
          label={amountLabel}
          value={asset.amountText}
          onChange={event => asset.onAmountChange(event.target.value)}
          onBlur={asset.onBlur}
          suffix={<span className="body-3 text-muted">{asset.ticker}</span>}
          hideClearButton
          disabled={disabled}
          inputMode="decimal"
          data-testid={`flex-mode-amount-${asset.currencyId}`}
        />
        <TextInput
          label={valueLabel}
          value={asset.fiatText}
          onChange={event => asset.onFiatChange(event.target.value)}
          onBlur={asset.onBlur}
          suffix={<span className="body-3 text-muted">{fiatTicker}</span>}
          hideClearButton
          disabled={disabled}
          inputMode="decimal"
          data-testid={`flex-mode-value-${asset.currencyId}`}
        />
      </div>
    </div>
  );
}

export default function FlexModeSettingsScreen() {
  const navigate = useNavigate();
  const { t, flexMode, setFlexMode, assets, formattedTotal, fiatTicker, onReset, hasCustomValues } =
    useFlexModeSettingsViewModel();

  return (
    <div className="flex min-h-0 flex-1 flex-col p-8 pb-16" data-testid="flex-mode-settings-screen">
      <TrackPage category="Settings" name="FlexMode" />

      <header className="mb-14 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 py-6">
        <div className="flex min-w-0 justify-start">
          <Button
            size="sm"
            appearance="no-background"
            onClick={() => navigate("/settings/accounts")}
            icon={ArrowLeft}
          >
            {t("common.back")}
          </Button>
        </div>
        <span className="heading-2-semi-bold text-center text-base">
          {t("settings.flexMode.title")}
        </span>
        <div aria-hidden className="min-w-0" />
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-16 px-4">
        <p className="body-2 text-muted">{t("settings.flexMode.desc")}</p>

        <div className="flex items-center justify-between gap-16 rounded-lg bg-surface p-16">
          <div className="flex min-w-0 flex-col">
            <span className="body-2-semi-bold text-base">{t("settings.flexMode.enable")}</span>
            <span className="body-3 text-muted">{t("settings.flexMode.enableDesc")}</span>
          </div>
          <Switch selected={flexMode} onChange={setFlexMode} data-testid="flexMode" />
        </div>

        <section className="flex flex-col gap-12">
          {assets.map(asset => (
            <AssetRow
              key={asset.currencyId}
              asset={asset}
              fiatTicker={fiatTicker}
              amountLabel={t("settings.flexMode.amountLabel")}
              valueLabel={t("settings.flexMode.valueLabel")}
              autoLabel={t("settings.flexMode.autoIncluded")}
              disabled={!flexMode}
            />
          ))}
        </section>

        <div
          className="flex items-center justify-between gap-16 rounded-lg bg-surface p-16"
          data-testid="flex-mode-total"
        >
          <span className="body-2-semi-bold text-base">
            {t("settings.flexMode.portfolioTotal")}
          </span>
          <span className="heading-3-semi-bold text-base tabular-nums">{formattedTotal}</span>
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            appearance="no-background"
            onClick={onReset}
            disabled={!hasCustomValues}
            data-testid="flex-mode-reset"
          >
            {t("settings.flexMode.reset")}
          </Button>
        </div>
      </main>
    </div>
  );
}
