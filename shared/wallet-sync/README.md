# @shared/wallet-sync

Context-free aggregation core for Ledger Live wallet synchronisation.

Exports `createAggregator()` which composes a list of `WalletSyncDataManager` modules (accounts, accountNames, recentAddresses, …) into a single aggregated schema, diff, incremental-update resolver and apply function. Has no knowledge of Redux, React or networking — it is a pure data-transformation layer.

The `WalletSyncDataManager<LocalState, Update, Schema>` interface describes the contract each sync module must implement.
