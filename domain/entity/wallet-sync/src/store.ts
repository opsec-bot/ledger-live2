export type WSState = { data: Record<string, unknown> | null; version: number };

export type NonImportedAccountInfo = {
  id: string;
  attempts: number;
  attemptsLastTimestamp: number;
  error?: { name: string; message: string };
};

export type WalletSyncState = {
  walletSyncState: WSState;
  nonImportedAccountInfos: NonImportedAccountInfo[];
};

export const initialWalletSyncState: WalletSyncState = {
  walletSyncState: { data: null, version: 0 },
  nonImportedAccountInfos: [],
};

export type ExportedWalletSyncState = {
  walletSyncState: WSState;
  nonImportedAccountInfos: NonImportedAccountInfo[];
};

export const walletSyncStateSelector = (state: WalletSyncState): WSState => state.walletSyncState;
