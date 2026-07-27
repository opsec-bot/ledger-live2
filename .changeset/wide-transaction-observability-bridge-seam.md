---
"@ledgerhq/live-common": minor
"ledger-live-desktop": minor
---

Add wide transaction (sign + broadcast) observability at the account-bridge seam. `wrapAccountBridge` now decorates `signOperation` and `broadcast` and emits a normalized `LogEvent` (stage, status, `ErrorCategory`, currency, flow) through a global observer registry (`setTransactionObserver`/`emitTransactionEvent`), covering every route (native send/staking, wallet-api, dApp) and coin without touching the pure coin modules. Adds funnel `started` and sign-prompt `abandoned` events from the device-action layer, and classifies device/transport status errors (incl. on-device declines). Desktop registers a dev-only console observer to verify events locally.
