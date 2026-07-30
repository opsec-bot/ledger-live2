import { BigNumber } from "bignumber.js";
import {
  isFlexModeAsset,
  buildFlexPortfolio,
  buildFlexBalanceHistory,
  buildFlexPnl,
  computeFlexShare,
  findFlexAsset,
  flexDistributionPercentage,
  getDefaultFlexModeAssets,
  impliedFlexPrice,
  projectFlexBalanceHistory,
  scaleFlexAsset,
  toBaseUnits,
  fiatValueFromAmount,
  amountFromFiatValue,
  parseFlexAmountInput,
  FLEX_MODE_AUTO_MULTIPLIER,
  FLEX_MODE_SUPPORTED_ASSETS,
  FLEX_MODE_VALUE_CHANGE_PERCENTAGE,
} from "../flexMode";

const btcUnit = { name: "bitcoin", code: "BTC", magnitude: 8 };
const usdUnit = { name: "US Dollar", code: "USD", magnitude: 2 };

describe("flexMode", () => {
  it("recognizes only the flex mode asset tickers", () => {
    expect(isFlexModeAsset("BTC")).toBe(true);
    expect(isFlexModeAsset("btc")).toBe(true);
    expect(isFlexModeAsset("DOGE")).toBe(false);
  });

  it("falls back to the registry defaults when nothing is persisted", () => {
    const portfolio = buildFlexPortfolio({});
    expect(portfolio.assets).toHaveLength(FLEX_MODE_SUPPORTED_ASSETS.length);
    expect(portfolio.assets.map(a => a.ticker).sort()).toEqual(["BTC", "ETH", "LTC", "SOL"]);
  });

  it("computes the total as the sum of the per-asset fiat values", () => {
    const portfolio = buildFlexPortfolio({
      bitcoin: { amount: "3", fiatValue: "300000" },
      ethereum: { amount: "10", fiatValue: "40000" },
      solana: { amount: "100", fiatValue: "20000" },
      litecoin: { amount: "50", fiatValue: "5000" },
    });
    expect(portfolio.totalFiat.toNumber()).toBe(365_000);
  });

  it("sorts assets by displayed fiat value, descending", () => {
    const portfolio = buildFlexPortfolio({
      bitcoin: { amount: "0.1", fiatValue: "10" },
      ethereum: { amount: "1", fiatValue: "9000" },
      solana: { amount: "1", fiatValue: "500" },
      litecoin: { amount: "1", fiatValue: "1000" },
    });
    expect(portfolio.assets.map(a => a.ticker)).toEqual(["ETH", "LTC", "SOL", "BTC"]);
  });

  it("includes persisted assets outside the current registry", () => {
    const portfolio = buildFlexPortfolio({
      dogecoin: { amount: "1000000", fiatValue: "999999999" },
    });
    const doge = findFlexAsset(portfolio, { currencyId: "dogecoin" });
    expect(doge?.amount.toNumber()).toBe(1_000_000);
    expect(portfolio.assets[0].currencyId).toBe("dogecoin");
  });

  it("ignores malformed or negative persisted values and falls back to the default", () => {
    const portfolio = buildFlexPortfolio({
      bitcoin: { amount: "-5", fiatValue: "not-a-number" },
    });
    const btc = findFlexAsset(portfolio, { currencyId: "bitcoin" });
    const defaults = getDefaultFlexModeAssets();
    expect(btc?.amount.toFixed()).toBe(new BigNumber(defaults.bitcoin.amount).toFixed());
  });

  it("looks assets up by currency id or by ticker", () => {
    const portfolio = buildFlexPortfolio({});
    expect(findFlexAsset(portfolio, { currencyId: "ethereum" })?.ticker).toBe("ETH");
    expect(findFlexAsset(portfolio, { ticker: "ltc" })?.currencyId).toBe("litecoin");
    expect(findFlexAsset(portfolio, { ticker: "DOGE" })).toBeUndefined();
  });

  it("scales a display value to the currency's smallest display unit", () => {
    expect(toBaseUnits(new BigNumber(1_000_000), usdUnit).toNumber()).toBe(1_000_000 * 100);
    expect(toBaseUnits(new BigNumber(1.5), btcUnit).toNumber()).toBe(150_000_000);
  });

  it("keeps amount and fiat value in sync through the market price", () => {
    const price = new BigNumber(120_000);
    const fiat = fiatValueFromAmount(new BigNumber(3.42), price);
    expect(fiat.toNumber()).toBe(410_400);
    expect(amountFromFiatValue(fiat, price).toNumber()).toBe(3.42);
  });

  it("returns zero rather than dividing by a missing price", () => {
    expect(amountFromFiatValue(new BigNumber(1000), new BigNumber(0)).toNumber()).toBe(0);
  });

  it("parses partial user input tolerantly", () => {
    expect(parseFlexAmountInput("1,920")?.toNumber()).toBe(1920);
    expect(parseFlexAmountInput("3.")?.toNumber()).toBe(3);
    expect(parseFlexAmountInput("")).toBeUndefined();
    expect(parseFlexAmountInput(".")).toBeUndefined();
    expect(parseFlexAmountInput("-1")).toBeUndefined();
    expect(parseFlexAmountInput("abc")).toBeUndefined();
  });

  describe("apportioning across account rows", () => {
    it("gives a row its share of the asset's display value", () => {
      expect(computeFlexShare(new BigNumber(25), new BigNumber(100)).toNumber()).toBe(0.25);
    });

    it("shows the whole value when there is no real balance to split", () => {
      expect(computeFlexShare(new BigNumber(0), new BigNumber(0)).toNumber()).toBe(1);
    });

    it("clamps a row that exceeds the currency total to the whole value", () => {
      expect(computeFlexShare(new BigNumber(500), new BigNumber(100)).toNumber()).toBe(1);
    });

    it("keeps apportioned rows summing to the asset total", () => {
      const asset = findFlexAsset(buildFlexPortfolio({}), { ticker: "BTC" })!;
      const accountBalances = [new BigNumber(60), new BigNumber(30), new BigNumber(10)];
      const total = accountBalances.reduce((sum, b) => sum.plus(b), new BigNumber(0));

      const rows = accountBalances.map(balance =>
        scaleFlexAsset(asset, computeFlexShare(balance, total)),
      );

      expect(rows.reduce((sum, row) => sum.plus(row.fiatValue), new BigNumber(0)).toFixed(2)).toBe(
        asset.fiatValue.toFixed(2),
      );
      expect(rows.reduce((sum, row) => sum.plus(row.amount), new BigNumber(0)).toFixed(8)).toBe(
        asset.amount.toFixed(8),
      );
    });
  });

  describe("auto-including held assets", () => {
    const usdc = {
      currencyId: "usd_coin",
      ticker: "USDC",
      amount: new BigNumber(1_000),
      fiatValue: new BigNumber(1_000),
    };

    it("scales a held asset up instead of showing its real value", () => {
      const portfolio = buildFlexPortfolio({}, [usdc]);
      const included = findFlexAsset(portfolio, { currencyId: "usd_coin" });

      expect(included?.fiatValue.toNumber()).toBe(1_000 * FLEX_MODE_AUTO_MULTIPLIER);
      expect(included?.amount.toNumber()).toBe(1_000 * FLEX_MODE_AUTO_MULTIPLIER);
      expect(included?.isAuto).toBe(true);
    });

    it("counts auto-included assets in the portfolio total", () => {
      const withoutUsdc = buildFlexPortfolio({});
      const withUsdc = buildFlexPortfolio({}, [usdc]);

      expect(withUsdc.totalFiat.minus(withoutUsdc.totalFiat).toNumber()).toBe(
        1_000 * FLEX_MODE_AUTO_MULTIPLIER,
      );
    });

    it("never overrides an explicit setting with a held balance", () => {
      const portfolio = buildFlexPortfolio({ usd_coin: { amount: "5", fiatValue: "5" } }, [usdc]);
      const included = findFlexAsset(portfolio, { currencyId: "usd_coin" });

      expect(included?.fiatValue.toNumber()).toBe(5);
      expect(included?.isAuto).toBeUndefined();
    });

    it("leaves the configured registry assets alone", () => {
      const held = {
        currencyId: "bitcoin",
        ticker: "BTC",
        amount: new BigNumber(0.001),
        fiatValue: new BigNumber(100),
      };
      const portfolio = buildFlexPortfolio({}, [held]);
      const btc = findFlexAsset(portfolio, { currencyId: "bitcoin" })!;

      expect(btc.isAuto).toBeUndefined();
      expect(btc.amount.toFixed()).toBe("3.42");
    });

    it("skips zero-balance holdings", () => {
      const portfolio = buildFlexPortfolio({}, [
        { ...usdc, amount: new BigNumber(0), fiatValue: new BigNumber(0) },
      ]);
      expect(findFlexAsset(portfolio, { currencyId: "usd_coin" })).toBeUndefined();
    });

    it("derives a usable price from an auto asset's own values", () => {
      const portfolio = buildFlexPortfolio({}, [
        { ...usdc, amount: new BigNumber(500), fiatValue: new BigNumber(1_000) },
      ]);
      const included = findFlexAsset(portfolio, { currencyId: "usd_coin" })!;

      expect(impliedFlexPrice(included)?.toNumber()).toBe(2);
    });

    it("has no implied price for a zero-amount asset", () => {
      expect(
        impliedFlexPrice({
          currencyId: "x",
          ticker: "X",
          amount: new BigNumber(0),
          fiatValue: new BigNumber(10),
        }),
      ).toBeUndefined();
    });
  });

  it("derives allocation percentages that add up to 100", () => {
    const portfolio = buildFlexPortfolio({
      bitcoin: { amount: "3", fiatValue: "300000" },
      ethereum: { amount: "10", fiatValue: "100000" },
      solana: { amount: "100", fiatValue: "50000" },
      litecoin: { amount: "50", fiatValue: "50000" },
    });
    const percentages = portfolio.assets.map(asset => flexDistributionPercentage(portfolio, asset));
    expect(percentages).toEqual([60, 20, 10, 10]);
  });

  it("derives PnL numbers that reconcile with the displayed total and uptick", () => {
    const total = new BigNumber(1_000_000);
    const pnl = buildFlexPnl(total);

    expect(pnl.costBasis.plus(pnl.unrealisedPnL).toFixed(2)).toBe(total.toFixed(2));
    expect(pnl.realisedPnL.toNumber()).toBe(0);
    expect(pnl.totalPnL.isEqualTo(pnl.unrealisedPnL)).toBe(true);
    expect(pnl.unrealisedPnL.div(pnl.costBasis).toNumber()).toBeCloseTo(
      FLEX_MODE_VALUE_CHANGE_PERCENTAGE,
      10,
    );
  });

  it("builds a balance history curve that ends exactly at the portfolio total", () => {
    const history = buildFlexBalanceHistory(new BigNumber(1_000_000), usdUnit, 10);
    expect(history).toHaveLength(10);
    expect(history[history.length - 1].value).toBe(1_000_000 * 100);
    expect(history.every(point => point.value >= 0)).toBe(true);
  });

  it("handles a degenerate single-point history without producing NaN", () => {
    const history = buildFlexBalanceHistory(new BigNumber(1_000), usdUnit, 1);
    expect(history).toHaveLength(1);
    expect(history[0].value).toBe(1_000 * 100);
  });

  it("keeps the real history's dates when projecting the curve onto it", () => {
    const realHistory = [
      { date: new Date("2026-01-01T00:00:00Z"), value: 5 },
      { date: new Date("2026-01-01T01:00:00Z"), value: 7 },
      { date: new Date("2026-01-01T02:00:00Z"), value: 9 },
    ];
    const history = projectFlexBalanceHistory(new BigNumber(1_000_000), usdUnit, realHistory);

    expect(history.map(p => p.date)).toEqual(realHistory.map(p => p.date));
    expect(history[history.length - 1].value).toBe(1_000_000 * 100);
    expect(history.every(point => Number.isFinite(point.value) && point.value >= 0)).toBe(true);
  });
});
