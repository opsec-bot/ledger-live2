import { Account, TokenAccount } from "@ledgerhq/types-live";
import type { CryptoCurrency, TokenCurrency } from "@ledgerhq/types-cryptoassets";
import { initialState as walletState } from "@ledgerhq/live-wallet/store";
import BigNumber from "bignumber.js";
import "../__tests__/test-helpers/setup";
import type { Transaction } from "../coin-modules/transaction-types";
import { accountToWalletAPIAccount, getWalletAPITransactionSignFlowInfos } from "./converters";
import type { WalletAPITransaction } from "./types";

// Minimal hermetic fixtures — only the fields accountToWalletAPIAccount reads, so the
// test needs no genAccount/currencies-resolver bootstrap.
const currency = {
  id: "ethereum",
  name: "Ethereum",
} as unknown as CryptoCurrency;

const makeMainAccount = (id: string, readiness?: Account["readiness"]): Account =>
  ({
    type: "Account",
    id,
    index: 0,
    currency,
    freshAddress: "0x0000000000000000000000000000000000000001",
    balance: new BigNumber(1),
    spendableBalance: new BigNumber(1),
    blockHeight: 1,
    lastSyncDate: new Date(0),
    readiness,
  }) as Account;

const makeTokenAccount = (id: string, parentId: string): TokenAccount =>
  ({
    type: "TokenAccount",
    id,
    parentId,
    token: {
      id: "ethereum/erc20/mtk",
      name: "Mock Token",
      ticker: "MTK",
    } as unknown as TokenCurrency,
    balance: new BigNumber(0),
    spendableBalance: new BigNumber(0),
  }) as TokenAccount;

const evmBridge = jest.fn();
const bitcoinBridge = jest.fn();
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
  it("passes the account readiness through", () => {
    const account = makeMainAccount("readiness-not-ready", {
      ready: false,
      reason: "unrevealed",
    });

    const walletApiAccount = accountToWalletAPIAccount(walletState, account);

    expect(walletApiAccount.readiness).toEqual({
      ready: false,
      reason: "unrevealed",
    });
  });

  it("leaves readiness undefined when the account has none", () => {
    const account = makeMainAccount("readiness-absent");

    const walletApiAccount = accountToWalletAPIAccount(walletState, account);

    expect(walletApiAccount.readiness).toBeUndefined();
  });

  it("derives a token account's readiness from its parent", () => {
    const parentAccount = makeMainAccount("readiness-parent", {
      ready: false,
      reason: "unrevealed",
    });
    const tokenAccount = makeTokenAccount(`${parentAccount.id}|0`, parentAccount.id);

    const walletApiAccount = accountToWalletAPIAccount(walletState, tokenAccount, parentAccount);

    expect(walletApiAccount.readiness).toEqual({
      ready: false,
      reason: "unrevealed",
    });
  });
});
