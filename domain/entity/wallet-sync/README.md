# @domain/entity-wallet-sync

RTK slice for WalletSync protocol state.

State shape: `{ walletSyncState: WSState, nonImportedAccountInfos: NonImportedAccountInfo[] }`. Tracks the current sync status (version, distant state) and accounts that exist in the cloud but are not yet imported locally. Exports `walletSyncSlice`, actions (`walletSyncUpdate`, `setNonImportedAccounts`) and selector `walletSyncStateSelector`.
