import { Account } from "@ledgerhq/types-live";
import BigNumber from "bignumber.js";
import { initialState } from "@ledgerhq/live-wallet/store";
import "../__tests__/test-helpers/setup";
import type { Transaction } from "../coin-modules/transaction-types";
import { accountToWalletAPIAccount, getWalletAPITransactionSignFlowInfos } from "./converters";
import type { WalletAPITransaction } from "./types";
import {
  createFixtureAccount,
  createFixtureCryptoCurrency,
  createFixtureTokenAccount,
} from "../mock/fixtures/cryptoCurrencies";

const evmBridge = jest.fn();
const bitcoinBridge = jest.fn();
const getSpendableBalanceForFamily = jest.fn();
jest.mock("../coin-modules/registry", () => ({
  loadWalletApiAdapterForFamily: (family: string) => {
    switch (family) {
      case "evm":
        return { getWalletAPITransactionSignFlowInfos: () => evmBridge() };
      case "bitcoin":
        return { getWalletAPITransactionSignFlowInfos: () => bitcoinBridge() };
      default:
        return undefined;
    }
  },
  getSpendableBalanceForFamily: (family: string) => getSpendableBalanceForFamily(family),
}));

describe("getWalletAPITransactionSignFlowInfos", () => {
  beforeEach(() => {
    evmBridge.mockClear();
    bitcoinBridge.mockClear();
  });

  it("should call the bridge if the implementation exists", async () => {
    // Given
    const tx: WalletAPITransaction = {
      family: "bitcoin",
      amount: new BigNumber(100000),
      recipient: "0xABCDEF",
    };

    // When
    await getWalletAPITransactionSignFlowInfos({
      walletApiTransaction: tx,
      account: {} as Account,
    });

    // Then
    expect(bitcoinBridge).toHaveBeenCalledTimes(1);
    expect(evmBridge).toHaveBeenCalledTimes(0);
  });

  it("should call the evm bridge for WalletAPITransaction tx of ethereum family", async () => {
    // Given
    const tx: WalletAPITransaction = {
      family: "ethereum",
      amount: new BigNumber(100000),
      recipient: "0xABCDEF",
    };

    // When
    await getWalletAPITransactionSignFlowInfos({
      walletApiTransaction: tx,
      account: {} as Account,
    });

    // Then
    expect(evmBridge).toHaveBeenCalledTimes(1);
    expect(bitcoinBridge).toHaveBeenCalledTimes(0);
  });

  it("should use its fallback if the bridge doesn't exist", async () => {
    // Given
    const tx: WalletAPITransaction = {
      family: "algorand",
      mode: "send",
      amount: new BigNumber(100000),
      recipient: "0xABCDEF",
    };

    const expectedLiveTx: Partial<Transaction> = {
      family: tx.family,
      mode: "send",
      amount: tx.amount,
      recipient: tx.recipient,
    };

    // When
    const { canEditFees, hasFeesProvided, liveTx } = await getWalletAPITransactionSignFlowInfos({
      walletApiTransaction: tx,
      account: {} as Account,
    });

    // Then
    expect(evmBridge).toHaveBeenCalledTimes(0);
    expect(bitcoinBridge).toHaveBeenCalledTimes(0);
    expect(canEditFees).toBe(false);
    expect(hasFeesProvided).toBe(false);
    expect(liveTx).toEqual(expectedLiveTx);
  });
});

describe("accountToWalletAPIAccount", () => {
  const walletState = initialState;

  beforeEach(() => {
    getSpendableBalanceForFamily.mockReset();
  });

  it("uses account.spendableBalance when no override is registered for the family", () => {
    getSpendableBalanceForFamily.mockReturnValue(undefined);
    const account = createFixtureAccount("00", createFixtureCryptoCurrency("no-override-family"));

    const result = accountToWalletAPIAccount(walletState, account);

    expect(result).toEqual(
      expect.objectContaining({
        balance: account.balance,
        spendableBalance: account.spendableBalance,
      }),
    );
  });

  it("uses the family override's return value for spendableBalance, leaving balance untouched", () => {
    const account = createFixtureAccount(
      "00",
      createFixtureCryptoCurrency("restricted-spend-family"),
    );
    const publicPortion = new BigNumber(60);
    getSpendableBalanceForFamily.mockReturnValue(() => publicPortion);

    const result = accountToWalletAPIAccount(walletState, account);

    expect(getSpendableBalanceForFamily).toHaveBeenCalledWith("restricted-spend-family");
    expect(result).toEqual(
      expect.objectContaining({
        balance: account.balance,
        spendableBalance: publicPortion,
      }),
    );
  });

  it("falls back to account.spendableBalance when a registered override returns undefined", () => {
    const account = createFixtureAccount(
      "00",
      createFixtureCryptoCurrency("restricted-spend-family"),
    );
    getSpendableBalanceForFamily.mockReturnValue(() => undefined);

    const result = accountToWalletAPIAccount(walletState, account);

    expect(result.spendableBalance).toEqual(account.spendableBalance);
  });

  it("applies the parent account's family override to token accounts", () => {
    const parentAccount = createFixtureAccount(
      "00",
      createFixtureCryptoCurrency("restricted-spend-family"),
    );
    const tokenAccount = createFixtureTokenAccount("00");
    const publicPortion = new BigNumber(10);
    getSpendableBalanceForFamily.mockReturnValue(() => publicPortion);

    const result = accountToWalletAPIAccount(walletState, tokenAccount, parentAccount);

    expect(getSpendableBalanceForFamily).toHaveBeenCalledWith("restricted-spend-family");
    expect(result).toEqual(
      expect.objectContaining({
        balance: tokenAccount.balance,
        spendableBalance: publicPortion,
      }),
    );
  });

  it("throws when a token account is given without a parent account", () => {
    const tokenAccount = createFixtureTokenAccount("00");

    expect(() => accountToWalletAPIAccount(walletState, tokenAccount)).toThrow(
      "No 'parentAccount' account provided for token account",
    );
  });
});
