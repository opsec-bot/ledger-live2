# @features/platform-wallet-sync

Platform-level orchestration for Ledger Live wallet synchronisation.

Wires together `@shared/cloud-sync` (network), `@shared/wallet-sync` (aggregation) and the domain entity modules into a runnable watch loop. Exports:

- `createWalletSyncWatchLoop` — drives push/pull cycles using a `CloudSyncSDKInterface`
- `makeSaveNewUpdate` / `makeLocalIncrementalUpdate` — helpers for processing incoming sync events and dispatching Redux actions
- `trustchainLifecycle` / `liveSlug` — lifecycle hooks called on trustchain rotation
