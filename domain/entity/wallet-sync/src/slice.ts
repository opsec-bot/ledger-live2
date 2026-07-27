import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { WSState, NonImportedAccountInfo, WalletSyncState } from "./store";

export const walletSyncSlice = createSlice({
  name: "walletSync",
  initialState: {
    walletSyncState: { data: null, version: 0 },
    nonImportedAccountInfos: [],
  } as WalletSyncState,
  reducers: {
    walletSyncUpdate: (
      state,
      { payload }: PayloadAction<{ data: Record<string, unknown> | null; version: number }>,
    ) => {
      state.walletSyncState.data = payload.data;
      state.walletSyncState.version = payload.version;
    },
    setNonImportedAccounts: (state, { payload }: PayloadAction<NonImportedAccountInfo[]>) => {
      state.nonImportedAccountInfos = payload;
    },
  },
});

export const { walletSyncUpdate, setNonImportedAccounts } = walletSyncSlice.actions;
