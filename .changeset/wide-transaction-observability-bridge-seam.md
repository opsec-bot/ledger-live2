---
"@ledgerhq/live-common": minor
"ledger-live-desktop": minor
---

Add wide transaction (sign + broadcast) observability at the account-bridge seam. `wrapAccountBridge` now decorates `signOperation` and `broadcast` and emits a normalized `LogEvent` (stage, status, `ErrorCategory`, currency, flow) through a global observer registry (`setTransactionObserver`/`emitTransactionEvent`), covering every route (native send/staking, wallet-api, dApp) and coin without touching the pure coin modules. Adds funnel `started` and sign-prompt `abandoned` events from the device-action layer, classifies device/transport status errors (incl. on-device declines), derives a `productFlow` (stake/unstake/restake/claim/send) distinct from the technical `flow`, and captures the delegation target `validators` (pool/validator id) at the sign stage. Desktop registers a dev-only console observer to verify events locally.
