import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore, useSelector, useDispatch } from "~/context/hooks";
import noop from "lodash/noop";
import { CloudSyncSDK, WalletSyncOutdated } from "@shared/cloud-sync";
import { createAggregator } from "@shared/wallet-sync";
import {
  createWalletSyncWatchLoop,
  liveSlug,
  makeSaveNewUpdate,
  makeLocalIncrementalUpdate,
} from "@features/platform-wallet-sync";
import { accountNamesSyncModule, setAccountNames } from "@domain/entity-account-name";
import { recentAddressesSyncModule, updateRecentAddresses } from "@domain/entity-recent-addresses";
import { bindCtx as bindLiveWalletAccountsCtx } from "@ledgerhq/live-wallet/walletsync/modules/accounts";
import { getAccountBridge } from "@ledgerhq/live-common/bridge/index";
import {
  memberCredentialsSelector,
  resetTrustchainStore,
  trustchainSelector,
} from "@ledgerhq/ledger-key-ring-protocol/store";
import {
  setNonImportedAccounts,
  walletSyncStateSelector,
  walletSyncUpdate,
} from "@domain/entity-wallet-sync";
import { useTrustchainSdk } from "./useTrustchainSdk";
import { useOnTrustchainRefreshNeeded } from "./useOnTrustchainRefreshNeeded";
import { Dispatch } from "redux";
import {
  walletSelector,
  latestDistantStateSelector,
  latestDistantVersionSelector,
} from "~/reducers/wallet";
import { State } from "~/reducers/types";
import { bridgeCache } from "~/bridge/cache";
import { replaceAccounts } from "~/actions/accounts";
import { useFeature } from "@features/platform-feature-flags";
import getWalletSyncEnvironmentParams from "@ledgerhq/live-common/walletSync/getEnvironmentParams";
import { TrustchainEjected, TrustchainOutdated } from "@ledgerhq/ledger-key-ring-protocol/errors";

// TODO: pass blacklistedTokenIdsSelector value here to respect the user's token blacklist
const accountsSyncModule = bindLiveWalletAccountsCtx({
  getAccountBridge,
  bridgeCache,
  blacklistedTokenIds: [],
});

const walletsync = createAggregator({
  accounts: accountsSyncModule,
  accountNames: accountNamesSyncModule,
  recentAddresses: recentAddressesSyncModule,
});

type Schema = typeof walletsync.schema;
type DistantState = Schema["_output"];
type LocalState = ReturnType<typeof walletsync.applyUpdate>;

function parseDistantState(raw: unknown): DistantState | null {
  const result = walletsync.schema.safeParse(raw);
  // Return raw (not result.data) to preserve unknown keys for forward compat
  return result.success ? (raw as DistantState) : null;
}

const latestWalletStateSelector = (s: State): { data: DistantState | null; version: number } => {
  const ws = walletSyncStateSelector(walletSelector(s).walletSync);
  return { data: parseDistantState(ws.data), version: ws.version };
};

function localStateSelector(state: State) {
  return {
    accounts: {
      list: state.accounts.active,
      nonImportedAccountInfos: state.wallet.walletSync.nonImportedAccountInfos,
    },
    accountNames: state.wallet.accountNames,
    recentAddresses: state.wallet.recentAddresses,
  };
}

async function save(
  data: DistantState | null,
  version: number,
  newLocalState: LocalState | null,
  dispatch: Dispatch,
) {
  dispatch(walletSyncUpdate({ data, version }));
  if (newLocalState) {
    dispatch(setNonImportedAccounts(newLocalState.accounts.nonImportedAccountInfos));
    dispatch(setAccountNames(newLocalState.accountNames));
    dispatch(updateRecentAddresses(newLocalState.recentAddresses));
    dispatch(replaceAccounts(newLocalState.accounts.list)); // IMPORTANT: keep this one last, it's doing the DB:* trigger to save the data
  }
}

export function useCloudSyncSDK(): CloudSyncSDK<Schema> {
  const featureWalletSync = useFeature("llmWalletSync");
  const { cloudSyncApiBaseUrl } = getWalletSyncEnvironmentParams(
    featureWalletSync?.params?.environment,
  );
  const trustchainSdk = useTrustchainSdk();
  const getState = useGetState();
  const getCurrentVersion = useCallback(
    () => latestWalletStateSelector(getState()).version,
    [getState],
  );
  const saveUpdate = useSaveUpdate();

  const saveNewUpdate = useMemo(
    () =>
      makeSaveNewUpdate({
        walletsync,
        getState,
        latestDistantStateSelector: s => parseDistantState(latestDistantStateSelector(s)),
        latestDistantVersionSelector,
        localStateSelector,
        saveUpdate,
      }),
    [getState, saveUpdate],
  );

  const cloudSyncSDK = useMemo(
    () =>
      new CloudSyncSDK({
        apiBaseUrl: cloudSyncApiBaseUrl,
        slug: liveSlug,
        schema: walletsync.schema,
        trustchainSdk,
        getCurrentVersion,
        saveNewUpdate,
      }),
    [cloudSyncApiBaseUrl, trustchainSdk, getCurrentVersion, saveNewUpdate],
  );

  return cloudSyncSDK;
}

export type WalletSyncUserState = {
  visualPending: boolean;
  walletSyncError: Error | null;
  onUserRefresh: () => void;
};

export function useWatchWalletSync(): WalletSyncUserState {
  const featureWalletSync = useFeature("llmWalletSync");
  const saveUpdate = useSaveUpdate();
  const getState = useGetState();
  const dispatch = useDispatch();
  const memberCredentials = useSelector(memberCredentialsSelector);
  const trustchain = useSelector(trustchainSelector);
  const trustchainSdk = useTrustchainSdk();
  const walletSyncSdk = useCloudSyncSDK();
  const onTrustchainRefreshNeeded = useOnTrustchainRefreshNeeded(trustchainSdk, memberCredentials);

  const [visualPending, setVisualPending] = useState(true);
  const [walletSyncError, setWalletSyncError] = useState<Error | null>(null);
  const onUserRefreshRef = useRef<() => void>(noop);
  const state = useMemo(
    () => ({ visualPending, walletSyncError, onUserRefresh: onUserRefreshRef.current }),
    [visualPending, walletSyncError],
  );

  const resetLedgerSync = useCallback(() => {
    dispatch(resetTrustchainStore());
    dispatch(walletSyncUpdate({ data: null, version: 0 }));
  }, [dispatch]);

  useEffect(() => {
    if (walletSyncError) {
      if (walletSyncError?.name === "TrustchainNotAllowed") resetLedgerSync();
      if (walletSyncError?.name === "TrustchainEjected") resetLedgerSync();
    }
  }, [dispatch, resetLedgerSync, walletSyncError]);

  // pull and push wallet sync loop
  useEffect(() => {
    const canNotRunWatchLoop = !featureWalletSync?.enabled || !trustchain || !memberCredentials;

    if (canNotRunWatchLoop) {
      onUserRefreshRef.current = noop;
      setVisualPending(false);
      setWalletSyncError(null);
      return;
    }

    const localIncrementUpdate = makeLocalIncrementalUpdate({
      walletsync,
      getState,
      latestWalletStateSelector,
      localStateSelector,
      saveUpdate,
    });

    const { unsubscribe, onUserRefreshIntent } = createWalletSyncWatchLoop({
      walletsync,
      walletSyncSdk,
      watchConfig: featureWalletSync?.params?.watchConfig,
      localIncrementUpdate,
      trustchain,
      memberCredentials,
      setVisualPending,
      getState,
      localStateSelector,
      latestDistantStateSelector: s => parseDistantState(latestDistantStateSelector(s)),
      onError: e => setWalletSyncError(e && e instanceof Error ? e : new Error(String(e))),
      onStartPolling: () => setWalletSyncError(null),
      onTrustchainRefreshNeeded,
      isTrustchainRefreshError: (e: unknown) =>
        e instanceof WalletSyncOutdated ||
        e instanceof TrustchainEjected ||
        e instanceof TrustchainOutdated,
    });

    onUserRefreshRef.current = onUserRefreshIntent;

    return unsubscribe;
  }, [
    featureWalletSync,
    getState,
    trustchainSdk,
    walletSyncSdk,
    trustchain,
    memberCredentials,
    onTrustchainRefreshNeeded,
    saveUpdate,
  ]);

  return state;
}

function useSaveUpdate() {
  const dispatch = useDispatch();
  return useCallback(
    (data: DistantState | null, version: number, newLocalState: LocalState | null) =>
      save(data, version, newLocalState, dispatch),
    [dispatch],
  );
}

function useGetState() {
  const store = useStore();
  return useCallback(() => store.getState(), [store]);
}
