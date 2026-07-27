import { useState, useEffect, useMemo, useRef } from "react";
import { getCryptoCurrencyById } from "@domain/entity-currency-crypto";
import type { CryptoCurrency } from "@ledgerhq/types-cryptoassets";
import type {
  PolkadotValidator,
  PolkadotNomination,
  PolkadotSearchFilter,
  PolkadotAccount,
} from "@ledgerhq/coin-polkadot";
import {
  getCurrentPolkadotPreloadData,
  getPolkadotPreloadDataUpdates,
  setPolkadotPreloadData,
} from "@ledgerhq/coin-polkadot/bridge/state";
import polkadotAPI from "@ledgerhq/coin-polkadot/network";
import useMemoOnce from "../../hooks/useMemoOnce";
import { useBridgeSync } from "../../bridge/react";

const SYNC_REFRESH_RATE = 6000; // 6s - block time

/**
 * Fetches Polkadot staking data (validators, staking progress, minimum bond
 * balance) on demand and caches it in the module-level store so the synchronous
 * consumers (canNominate, isElectionOpen, hasMinimumBondBalance) can read it.
 * Replaces the deprecated CurrencyBridge.preload/hydrate mechanism.
 */
export function usePolkadotPreloadData(currency?: CryptoCurrency) {
  const [state, setState] = useState(getCurrentPolkadotPreloadData);

  useEffect(() => {
    const sub = getPolkadotPreloadDataUpdates().subscribe(setState);
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cur = currency ?? getCryptoCurrencyById("polkadot");
    (async () => {
      const [staking, minimumBondBalance, validators] = await Promise.all([
        polkadotAPI.getStakingProgress(cur).catch(() => undefined),
        polkadotAPI.getMinimumBondBalance(cur).catch(() => undefined),
        polkadotAPI.getValidators("all", cur).catch(() => undefined),
      ]);
      if (cancelled) return;
      // Preserve previously loaded data when a fetch fails (e.g. offline or in
      // mock mode) instead of clobbering it with empty values.
      const previous = getCurrentPolkadotPreloadData();
      setPolkadotPreloadData({
        validators: validators ?? previous.validators,
        staking: staking ?? previous.staking,
        minimumBondBalance: minimumBondBalance
          ? minimumBondBalance.toString()
          : previous.minimumBondBalance,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [currency]);

  return state;
}
export const searchFilter: PolkadotSearchFilter = query => validator => {
  const terms = `${validator?.identity ?? ""} ${validator?.address ?? ""}`;
  return terms.toLowerCase().includes(query.toLowerCase().trim());
};

/** Hook to search and sort SR list according to initial votes and query */
export function useSortedValidators(
  search: string,
  validators: PolkadotValidator[],
  nominations: PolkadotNomination[],
  validatorSearchFilter: PolkadotSearchFilter = searchFilter,
): PolkadotValidator[] {
  const initialVotes = useMemoOnce(() => nominations.map(({ address }) => address));
  const sortedVotes = useMemo(
    () =>
      validators
        .filter(validator => initialVotes.includes(validator.address))
        .concat(validators.filter(validator => !initialVotes.includes(validator.address))),
    [validators, initialVotes],
  );
  const sr = useMemo(
    () => (search ? validators.filter(validatorSearchFilter(search)) : sortedVotes),
    [search, validators, sortedVotes, validatorSearchFilter],
  );
  return sr;
}

/**
 * Sync account until "controller" is set - following a first bond.
 *
 * @param {*} account
 */
export function usePolkadotBondLoading(account: PolkadotAccount) {
  const controller = account.polkadotResources?.controller || null;
  const initialAccount = useRef(account);
  const [isLoading, setLoading] = useState(!controller);
  useEffect(() => {
    if (controller) {
      setLoading(false);
    }
  }, [controller]);
  const sync = useBridgeSync();
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      sync({
        type: "SYNC_ONE_ACCOUNT",
        priority: 10,
        accountId: initialAccount.current.id,
        reason: "polkadot-bond-loading",
      });
    }, SYNC_REFRESH_RATE);
    return () => clearInterval(interval);
  }, [initialAccount, sync, isLoading]);
  return isLoading;
}
