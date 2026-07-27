# @domain/entity-recent-addresses

RTK slice and WalletSync module for recently used receive addresses.

State shape: `recentAddresses: RecentAddressesState`. Exports `recentAddressesSlice`, action `updateRecentAddresses` and `recentAddressesSyncModule` — a `WalletSyncDataManager` that syncs recent addresses across devices via `@shared/wallet-sync`.
