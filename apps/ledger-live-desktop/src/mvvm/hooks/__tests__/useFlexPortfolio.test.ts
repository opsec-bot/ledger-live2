import { BigNumber } from "bignumber.js";
import { genAccount } from "@ledgerhq/ledger-wallet-framework/mocks/account";
import { getCryptoCurrencyById } from "@domain/entity-currency-crypto";
import { renderHook } from "tests/testSetup";
import { useFlexPortfolio } from "../useFlexPortfolio";

const customAssets = {
  bitcoin: { amount: "3.42", fiatValue: "406231" },
  ethereum: { amount: "74.18", fiatValue: "281994" },
  solana: { amount: "1920", fiatValue: "367882" },
  litecoin: { amount: "812", fiatValue: "97441" },
};

describe("useFlexPortfolio", () => {
  it("returns an empty portfolio when flex mode is off", () => {
    const { result } = renderHook(() => useFlexPortfolio(), {
      initialState: { settings: { flexMode: false, flexModeAssets: customAssets } },
    });

    expect(result.current.enabled).toBe(false);
    expect(result.current.portfolio.assets).toHaveLength(0);
    expect(result.current.portfolio.totalFiat.toNumber()).toBe(0);
    expect(result.current.findAsset({ ticker: "BTC" })).toBeUndefined();
  });

  it("totals the configured per-asset fiat values when flex mode is on", () => {
    const { result } = renderHook(() => useFlexPortfolio(), {
      initialState: { settings: { flexMode: true, flexModeAssets: customAssets } },
    });

    expect(result.current.enabled).toBe(true);
    expect(result.current.portfolio.totalFiat.toNumber()).toBe(406231 + 281994 + 367882 + 97441);
  });

  it("exposes assets sorted by displayed value and resolvable by id or ticker", () => {
    const { result } = renderHook(() => useFlexPortfolio(), {
      initialState: { settings: { flexMode: true, flexModeAssets: customAssets } },
    });

    expect(result.current.portfolio.assets.map(a => a.ticker)).toEqual([
      "BTC",
      "SOL",
      "ETH",
      "LTC",
    ]);
    expect(result.current.findAsset({ currencyId: "solana" })?.amount.toNumber()).toBe(1920);
    expect(result.current.findAsset({ ticker: "ltc" })?.fiatValue.toNumber()).toBe(97441);
  });

  it("falls back to the registry defaults when nothing is configured", () => {
    const { result } = renderHook(() => useFlexPortfolio(), {
      initialState: { settings: { flexMode: true, flexModeAssets: {} } },
    });

    expect(result.current.portfolio.assets).toHaveLength(4);
    expect(result.current.portfolio.totalFiat.isGreaterThan(0)).toBe(true);
  });

  describe("resolveAsset (per-account rows)", () => {
    const btc = getCryptoCurrencyById("bitcoin");
    const accounts = [
      { ...genAccount("btc-1", { currency: btc }), balance: new BigNumber(75) },
      { ...genAccount("btc-2", { currency: btc }), balance: new BigNumber(25) },
    ];

    const renderWithAccounts = () =>
      renderHook(() => useFlexPortfolio(), {
        initialState: {
          accounts,
          settings: { flexMode: true, flexModeAssets: customAssets },
        },
      });

    it("apportions the asset value across accounts of the same currency", () => {
      const { result } = renderWithAccounts();

      expect(result.current.resolveAsset({ currencyId: "bitcoin" }, 75)?.fiatValue.toNumber()).toBe(
        406231 * 0.75,
      );
      expect(result.current.resolveAsset({ currencyId: "bitcoin" }, 25)?.fiatValue.toNumber()).toBe(
        406231 * 0.25,
      );
    });

    it("keeps the account rows summing to the whole asset value", () => {
      const { result } = renderWithAccounts();

      const rowsTotal = accounts.reduce(
        (sum, account) =>
          sum.plus(
            result.current.resolveAsset({ currencyId: "bitcoin" }, account.balance)?.fiatValue ?? 0,
          ),
        new BigNumber(0),
      );

      expect(rowsTotal.toNumber()).toBe(
        result.current.findAsset({ currencyId: "bitcoin" })!.fiatValue.toNumber(),
      );
    });

    it("returns the whole value for a row carrying the currency's full balance", () => {
      const { result } = renderWithAccounts();

      expect(
        result.current.resolveAsset({ currencyId: "bitcoin" }, 100)?.fiatValue.toNumber(),
      ).toBe(406231);
    });

    it("returns the whole value when no accounts exist to apportion across", () => {
      const { result } = renderHook(() => useFlexPortfolio(), {
        initialState: { accounts: [], settings: { flexMode: true, flexModeAssets: customAssets } },
      });

      expect(result.current.resolveAsset({ currencyId: "bitcoin" }, 0)?.fiatValue.toNumber()).toBe(
        406231,
      );
    });

    it("returns undefined for an asset outside Flex Mode", () => {
      const { result } = renderWithAccounts();
      expect(result.current.resolveAsset({ ticker: "DOGE" }, 10)).toBeUndefined();
    });
  });
});
