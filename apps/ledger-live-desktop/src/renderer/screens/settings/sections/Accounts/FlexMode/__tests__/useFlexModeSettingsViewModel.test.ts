import { BigNumber } from "bignumber.js";
import { act } from "@testing-library/react";
import { renderHook } from "tests/testSetup";
import { useFlexModePrices } from "LLD/hooks/useFlexModePrices";
import { useFlexModeSettingsViewModel } from "../useFlexModeSettingsViewModel";

jest.mock("LLD/hooks/useFlexModePrices", () => ({
  useFlexModePrices: jest.fn(),
}));

const PRICES: Record<string, number> = {
  bitcoin: 100_000,
  ethereum: 4_000,
  solana: 200,
  litecoin: 100,
};

const mockedUseFlexModePrices = jest.mocked(useFlexModePrices);

const initialState = {
  settings: {
    locale: "en-US",
    flexMode: true,
    flexModeAssets: {
      bitcoin: { amount: "3", fiatValue: "300000" },
      ethereum: { amount: "10", fiatValue: "40000" },
      solana: { amount: "100", fiatValue: "20000" },
      litecoin: { amount: "50", fiatValue: "5000" },
    },
  },
};

const renderViewModel = () => renderHook(() => useFlexModeSettingsViewModel(), { initialState });

const rowFor = (
  result: { current: ReturnType<typeof useFlexModeSettingsViewModel> },
  currencyId: string,
) => result.current.assets.find(asset => asset.currencyId === currencyId)!;

describe("useFlexModeSettingsViewModel", () => {
  beforeEach(() => {
    mockedUseFlexModePrices.mockReturnValue({
      getPrice: (currencyId: string) => new BigNumber(PRICES[currencyId] ?? 0),
      isLive: true,
    });
  });

  it("lists the configured assets sorted by displayed value", () => {
    const { result } = renderViewModel();
    expect(result.current.assets.map(a => a.ticker)).toEqual(["BTC", "ETH", "SOL", "LTC"]);
  });

  it("shows the portfolio total as the sum of the per-asset values", () => {
    const { result } = renderViewModel();
    expect(result.current.formattedTotal).toContain("365,000");
  });

  it("syncs the fiat value when the quantity is edited", () => {
    const { result } = renderViewModel();

    act(() => rowFor(result, "bitcoin").onAmountChange("4"));

    expect(rowFor(result, "bitcoin").fiatText).toBe("400,000");
    // The total itself eases toward 465,000 via useAnimatedNumber, so it is not
    // asserted here — see the mount-time total test above.
  });

  it("syncs the quantity when the fiat value is edited", () => {
    const { result } = renderViewModel();

    act(() => rowFor(result, "ethereum").onFiatChange("80000"));

    expect(rowFor(result, "ethereum").amountText).toBe("20");
  });

  it("keeps the raw text while typing an incomplete number without losing the stored value", () => {
    const { result } = renderViewModel();

    act(() => rowFor(result, "solana").onAmountChange("1"));
    act(() => rowFor(result, "solana").onAmountChange("1."));

    expect(rowFor(result, "solana").amountText).toBe("1.");
    // "1." parses as 1, so the fiat side stays in sync rather than blanking out.
    expect(rowFor(result, "solana").fiatText).toBe("200");
  });

  it("does not reorder rows while a field is being edited", () => {
    const { result } = renderViewModel();

    act(() => rowFor(result, "litecoin").onAmountChange("100000"));

    expect(result.current.assets.map(a => a.ticker)).toEqual(["BTC", "ETH", "SOL", "LTC"]);

    act(() => rowFor(result, "litecoin").onBlur());

    expect(result.current.assets.map(a => a.ticker)).toEqual(["LTC", "BTC", "ETH", "SOL"]);
  });

  it("restores the registry defaults on reset", () => {
    const { result } = renderViewModel();

    expect(result.current.hasCustomValues).toBe(true);

    act(() => result.current.onReset());

    expect(result.current.hasCustomValues).toBe(false);
  });
});
