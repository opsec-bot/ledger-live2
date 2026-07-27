import { makeLRUCache, minutes, hours } from "@ledgerhq/live-network/cache";
import { CryptoCurrency } from "@ledgerhq/ledger-wallet-framework/types";
import BigNumber from "bignumber.js";
import {
  PolkadotAccount,
  PolkadotNomination,
  PolkadotStakingProgress,
  PolkadotUnlocking,
  PolkadotValidator,
  Transaction,
} from "../types";
import { getOperations as bisonGetOperations } from "./bisontrails";
import {
  getAccount as sidecardGetAccount,
  getBalances as sidecardGetBalances,
  getMinimumBondBalance as sidecarGetMinimumBondBalance,
  getRegistry as sidecarGetRegistry,
  getStakingProgress as sidecarGetStakingProgress,
  getTransactionParams as sidecarGetTransactionParams,
  getValidators as sidecarGetValidators,
  isNewAccount as sidecarIsNewAccount,
  isControllerAddress as sidecarIsControllerAddress,
  isElectionClosed as sidecarIsElectionClosed,
  paymentInfo as sidecarPaymentInfo,
  submitExtrinsic as sidecarSubmitExtrinsic,
  submitExtrinsicDryRun as sidecarSubmitExtrinsicDryRun,
  verifyValidatorAddresses as sidecarVerifyValidatorAddresses,
  getMetadata as sidecarGetMetadata,
  getLastBlock,
} from "./sidecar";

type PolkadotAPIAccount = {
  blockHeight: number;
  balance: BigNumber;
  spendableBalance: BigNumber;
  nonce: number;
  lockedBalance: BigNumber;

  controller: string | null;
  stash: string | null;
  unlockedBalance: BigNumber;
  unlockingBalance: BigNumber;
  unlockings: PolkadotUnlocking[];
  numSlashingSpans?: number;

  nominations: PolkadotNomination[];
};

type PolkadotAPIBalanceInfo = {
  blockHeight: number;
  balance: BigNumber;
  spendableBalance: BigNumber;
  nonce: number;
  lockedBalance: BigNumber;
};

type CacheOpts = {
  force: boolean;
};

const getMinimumBondBalance = makeLRUCache(
  (currency: CryptoCurrency | undefined) => sidecarGetMinimumBondBalance(currency),
  (currency: CryptoCurrency | undefined) => currency?.id || "polkadot",
  hours(1, 1),
);
const getStakingProgress = makeLRUCache(
  (currency: CryptoCurrency) => sidecarGetStakingProgress(currency),
  (currency: CryptoCurrency) => currency.id,
  minutes(1),
);
const getValidators = makeLRUCache(
  (stashes: Parameters<typeof sidecarGetValidators>[0], currency: CryptoCurrency | undefined) =>
    sidecarGetValidators(stashes, currency),
  (stashes, currency) => {
    // sidecarGetValidators defaults undefined to "elected"; normalize + make the
    // array case order-independent so equivalent inputs share a cache entry.
    const normalized = stashes === undefined ? "elected" : stashes;
    const stashesKey = Array.isArray(normalized)
      ? [...normalized].sort().join(",")
      : String(normalized);
    return `${currency?.id || "polkadot"}_${stashesKey}`;
  },
  minutes(5),
);

/**
 * Seed the on-demand caches with deterministic data (used by the mock bridge in
 * tests). Mirrors the coin-tron `hydrateSuperRepresentatives` pattern: hydration
 * is folded into the LRU caches rather than a global store.
 */
export const hydrateValidators = (validators: PolkadotValidator[], currency?: CryptoCurrency) => {
  getValidators.hydrate(`${currency?.id || "polkadot"}_all`, validators);
};
export const hydrateStakingProgress = (
  staking: PolkadotStakingProgress,
  currency?: CryptoCurrency,
) => {
  getStakingProgress.hydrate(currency?.id || "polkadot", staking);
};
export const hydrateMinimumBondBalance = (
  minimumBondBalance: BigNumber,
  currency?: CryptoCurrency,
) => {
  getMinimumBondBalance.hydrate(currency?.id || "polkadot", minimumBondBalance);
};
const getRegistry = makeLRUCache(
  (currency: CryptoCurrency | undefined) => sidecarGetRegistry(currency),
  (currency: CryptoCurrency | undefined) => currency?.id || "polkadot",
  hours(1),
);

const getTransactionParamsFn = makeLRUCache(
  (currency: CryptoCurrency | undefined) => sidecarGetTransactionParams(currency),
  (currency: CryptoCurrency | undefined) => currency?.id || "polkadot",
  minutes(5),
);
const getPaymentInfo = makeLRUCache(
  async (
    { signedTx },
    currency: CryptoCurrency | undefined,
  ): Promise<{
    partialFee: string;
  }> => {
    return sidecarPaymentInfo(signedTx, currency);
  },
  ({ a, t, signedTx }) => hashTransactionParams(a, t, signedTx),
  minutes(5),
);
const paymentInfo = makeLRUCache(
  async (
    signedTx: string,
    currency: CryptoCurrency | undefined,
  ): Promise<{
    partialFee: string;
  }> => {
    return sidecarPaymentInfo(signedTx, currency);
  },
  signedTx => signedTx,
  minutes(5),
);

const isControllerAddress = makeLRUCache(
  (address: string, currency: CryptoCurrency | undefined) =>
    sidecarIsControllerAddress(address, currency),
  address => address,
  minutes(5),
);
const isElectionClosed = makeLRUCache(
  (currency: CryptoCurrency) => sidecarIsElectionClosed(currency),
  () => "",
  minutes(1),
);

const verifyValidatorAddresses = makeLRUCache(
  (validators: string[], currency: CryptoCurrency | undefined) =>
    sidecarVerifyValidatorAddresses(validators, currency),
  (validators, currency) => `${currency?.id || "polkadot"}_${[...validators].sort().join(",")}`,
  minutes(5),
);
const isNewAccount = makeLRUCache(
  (addr: string, currency: CryptoCurrency | undefined) => sidecarIsNewAccount(addr, currency),
  address => address,
  minutes(1),
);

const getMetadata = async (
  callData: string,
  includedInExtrinsic: string,
  includedInSignedData: string,
  currency?: CryptoCurrency,
): Promise<{ metadataBlob: string; metadataHash: string }> => {
  return sidecarGetMetadata(callData, includedInExtrinsic, includedInSignedData, currency);
};

export default {
  getAccount: async (address: string, currency: CryptoCurrency): Promise<PolkadotAPIAccount> =>
    sidecardGetAccount(address, currency),
  getBalances: async (
    address: string,
    currency?: CryptoCurrency,
  ): Promise<PolkadotAPIBalanceInfo> => sidecardGetBalances(address, currency),
  getOperations: bisonGetOperations,
  getLastBlock,
  getMinimumBondBalance,
  getRegistry,
  getStakingProgress,
  getValidators,
  getTransactionParams: async (
    currency?: CryptoCurrency,
    { force }: CacheOpts = { force: false },
  ) => {
    return force ? getTransactionParamsFn.force(currency) : getTransactionParamsFn(currency);
  },
  getPaymentInfo,
  paymentInfo,
  isControllerAddress,
  isElectionClosed,
  isNewAccount,
  getMetadata,
  submitExtrinsic: async (extrinsic: string, currency?: CryptoCurrency) =>
    sidecarSubmitExtrinsic(extrinsic, currency),
  verifyValidatorAddresses,
  submitExtrinsicDryRun: async (extrinsic: string, currency?: CryptoCurrency) =>
    sidecarSubmitExtrinsicDryRun(extrinsic, currency),
};

/**
 * Create a hash for a transaction that is params-specific and stay unchanged if no influcing fees
 *
 * @param {*} a
 * @param {*} t
 *
 * @returns {string} hash
 */
const hashTransactionParams = (
  { id, polkadotResources }: PolkadotAccount,
  { mode, rewardDestination, validators, numSlashingSpans, era }: Transaction,
  signedTx: string,
) => {
  // Nonce is added to discard previous estimation when account is synced.
  const prefix = `${id}_${polkadotResources?.nonce || 0}_${mode}`;
  // Fees depends on extrinsic bytesize
  const byteSize = signedTx.length;

  // And on extrinsic weight (which varies with the method called)
  switch (mode) {
    case "send":
      return `${prefix}_${byteSize}`;

    case "bond":
      return rewardDestination
        ? `${prefix}_${byteSize}_${rewardDestination}`
        : `${prefix}_${byteSize}`;

    case "unbond":
    case "rebond":
      return `${prefix}_${byteSize}`;

    case "nominate":
      return `${prefix}_${validators?.length ?? "0"}`;

    case "withdrawUnbonded":
      return `${prefix}_${numSlashingSpans ?? "0"}`;

    case "chill":
      return `${prefix}`;
    case "setController":
      return `${prefix}`;
    case "claimReward":
      return `${prefix}_${era || "0"}`;

    default:
      throw new Error("Unknown mode in transaction");
  }
};
