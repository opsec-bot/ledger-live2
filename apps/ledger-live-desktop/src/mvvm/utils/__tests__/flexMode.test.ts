import { BigNumber } from "bignumber.js";
import {
  isFlexModeAsset,
  getFlexAssetFiatUsd,
  getFlexAssetBaseUnits,
  getFlexModeFiatBaseUnits,
  buildFlexBalanceHistory,
  FLEX_MODE_ASSETS,
} from "../flexMode";

const btcUnit = { name: "bitcoin", code: "BTC", magnitude: 8 };
const usdUnit = { name: "US Dollar", code: "USD", magnitude: 2 };

describe("flexMode", () => {
  it("recognizes only the flex mode asset tickers", () => {
    expect(isFlexModeAsset("BTC")).toBe(true);
    expect(isFlexModeAsset("btc")).toBe(true);
    expect(isFlexModeAsset("DOGE")).toBe(false);
  });

  it("splits the target across assets proportionally to their allocation", () => {
    const total = FLEX_MODE_ASSETS.reduce(
      (sum, asset) => sum + (getFlexAssetFiatUsd(asset.ticker, 1_000_000) ?? 0),
      0,
    );
    expect(total).toBeCloseTo(1_000_000, 6);
  });

  it("returns undefined fiat/quantity for an asset outside the flex allocation", () => {
    expect(getFlexAssetFiatUsd("DOGE", 1_000_000)).toBeUndefined();
    expect(getFlexAssetBaseUnits("DOGE", 1_000_000, btcUnit)).toBeUndefined();
  });

  it("derives a base-unit amount consistent with the fiat allocation", () => {
    const amount = getFlexAssetBaseUnits("BTC", 1_000_000, btcUnit);
    expect(amount).toBeInstanceOf(BigNumber);
    expect(amount?.isGreaterThan(0)).toBe(true);
  });

  it("scales the fiat total to the currency's smallest display unit", () => {
    const baseUnits = getFlexModeFiatBaseUnits(1_000_000, usdUnit);
    expect(baseUnits.toNumber()).toBe(1_000_000 * 100);
  });

  it("builds a balance history curve that ends exactly at the target", () => {
    const history = buildFlexBalanceHistory(1_000_000, usdUnit, 10);
    expect(history).toHaveLength(10);
    expect(history[history.length - 1].value).toBe(1_000_000 * 100);
    expect(history.every(point => point.value >= 0)).toBe(true);
  });
});
