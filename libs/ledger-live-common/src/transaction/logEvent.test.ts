import { setEnv } from "@ledgerhq/live-env";
import type { Account, AccountLike, SignedOperation } from "@ledgerhq/types-live";
import type { Transaction as WalletAPITransaction } from "@ledgerhq/wallet-api-core";
import {
  ErrorCategory,
  TransactionFlow,
  TransactionStage,
  buildTransactionCommonEvent,
  buildTransactionFailureEvent,
  buildTransactionSuccessEvent,
  classifyTransactionError,
  getTransactionType,
} from "./logEvent";

const mainAccount = {
  id: "main-account-id",
  type: "Account",
  currency: { id: "ethereum", family: "evm" },
} as unknown as Account;

const tokenAccount = {
  id: "sub-account-id",
  type: "TokenAccount",
  token: { id: "ethereum/erc20/usdc" },
} as unknown as AccountLike;

describe("buildTransactionCommonEvent", () => {
  beforeEach(() => setEnv("LEDGER_CLIENT_VERSION", "llc/test"));

  it("builds the common fields for a native-account transaction", () => {
    expect(
      buildTransactionCommonEvent({
        account: mainAccount,
        mainAccount,
        flow: TransactionFlow.WalletApiSignAndBroadcast,
        manifestId: "some-dapp",
        source: { type: "live-app", name: "some-dapp" },
        transactionType: "approve",
        isSendMax: true,
      }),
    ).toEqual({
      appVersion: "llc/test",
      flow: "wallet-api/transaction.signAndBroadcast",
      manifestId: "some-dapp",
      source: { type: "live-app", name: "some-dapp" },
      currencyId: "ethereum",
      family: "evm",
      transactionType: "approve",
      isTestnet: false,
      isSendMax: true,
    });
  });

  it("adds tokenId for token accounts and omits empty optionals", () => {
    const event = buildTransactionCommonEvent({
      account: tokenAccount,
      mainAccount,
      flow: TransactionFlow.Send,
    });
    expect(event.tokenId).toBe("ethereum/erc20/usdc");
    expect(event.manifestId).toBeUndefined();
    expect(event.transactionType).toBeUndefined();
    expect(event.isSendMax).toBe(false);
  });
});

describe("buildTransactionSuccessEvent / buildTransactionFailureEvent", () => {
  const common = buildTransactionCommonEvent({
    account: mainAccount,
    mainAccount,
    flow: TransactionFlow.Acre,
  });

  it("tags success as a broadcast-stage success", () => {
    const event = buildTransactionSuccessEvent(common);
    expect(event.status).toBe("success");
    expect(event.stage).toBe(TransactionStage.Broadcast);
  });

  it("tags a broadcast failure with category, stage and txPayload", () => {
    const signedOperation = {
      signature: "deadbeef",
      rawData: { psbt: "x" },
    } as unknown as SignedOperation;
    const event = buildTransactionFailureEvent(common, {
      stage: TransactionStage.Broadcast,
      error: new Error("insufficient_funds for transfer"),
      signedOperation,
    });
    expect(event.status).toBe("failure");
    expect(event.stage).toBe(TransactionStage.Broadcast);
    expect(event.errorCategory).toBe(ErrorCategory.GasInsufficientBalance);
    expect(event.txPayload).toEqual({ signature: "deadbeef", rawData: { psbt: "x" } });
  });

  it("tags a sign failure with no txPayload (signing never completed)", () => {
    const event = buildTransactionFailureEvent(common, {
      stage: TransactionStage.Sign,
      error: Object.assign(new Error(), { name: "UserRefusedOnDevice" }),
    });
    expect(event.stage).toBe(TransactionStage.Sign);
    expect(event.errorCategory).toBe(ErrorCategory.UserDeviceRefused);
    expect(event.txPayload).toBeUndefined();
  });

  it("coerces non-Error throwables", () => {
    const event = buildTransactionFailureEvent(common, {
      stage: TransactionStage.Broadcast,
      error: "boom",
    });
    expect(event.error).toBeInstanceOf(Error);
    expect(event.error.message).toBe("boom");
  });
});

describe("classifyTransactionError", () => {
  it.each([
    // device / user (sign stage)
    ["DisconnectedDevice", { name: "DisconnectedDevice" }, ErrorCategory.DeviceDisconnected],
    [
      "DisconnectedDeviceDuringOperation",
      { name: "DisconnectedDeviceDuringOperation" },
      ErrorCategory.DeviceDisconnected,
    ],
    ["WrongDeviceForAccount", { name: "WrongDeviceForAccount" }, ErrorCategory.DeviceWrongAccount],
    ["UserRefusedOnDevice", { name: "UserRefusedOnDevice" }, ErrorCategory.UserDeviceRefused],
    [
      "Signature interrupted (message)",
      { message: "Signature interrupted by user" },
      ErrorCategory.UserModalDismissed,
    ],
    [
      "Canceled by user (message)",
      { message: "Canceled by user" },
      ErrorCategory.UserModalDismissed,
    ],
    // gas / blockchain (broadcast stage)
    ["InsufficientFunds", { name: "InsufficientFunds" }, ErrorCategory.GasInsufficientBalance],
    ["NotEnoughBalance", { name: "NotEnoughBalance" }, ErrorCategory.GasInsufficientBalance],
    [
      "REPLACEMENT_UNDERPRICED (message)",
      { message: "replacement_underpriced" },
      ErrorCategory.GasFeeTooLow,
    ],
    ["SequenceNumberError", { name: "SequenceNumberError" }, ErrorCategory.Blockchain],
    ["NetworkError", { name: "NetworkError" }, ErrorCategory.Blockchain],
    ["NONCE_EXPIRED (message)", { message: "nonce_expired: foo" }, ErrorCategory.Blockchain],
    ["unknown", { name: "Error", message: "something weird" }, ErrorCategory.Unknown],
  ])("maps %s", (_label, partial, expected) => {
    const error = Object.assign(new Error(), partial) as Error;
    expect(classifyTransactionError(error)).toBe(expected);
  });
});

describe("getTransactionType", () => {
  it("returns undefined when no transaction", () => {
    expect(getTransactionType(undefined)).toBeUndefined();
  });

  it("reads mode for families that expose one (cosmos)", () => {
    const tx = { family: "cosmos", mode: "delegate" } as unknown as WalletAPITransaction;
    expect(getTransactionType(tx)).toBe("delegate");
  });

  it("returns 'send' for families without a discriminator (bitcoin)", () => {
    const tx = { family: "bitcoin" } as unknown as WalletAPITransaction;
    expect(getTransactionType(tx)).toBe("send");
  });

  it("reads solana model.kind", () => {
    const tx = {
      family: "solana",
      model: { kind: "token.transfer" },
    } as unknown as WalletAPITransaction;
    expect(getTransactionType(tx)).toBe("token.transfer");
  });
});
