# @shared/cloud-sync

Generic cloud sync networking layer for Ledger Live wallet synchronisation.

Provides `CloudSyncSDK` — a protocol-agnostic client that fetches, uploads and deletes encrypted wallet state on the WalletSync atomic API, and listens for real-time push notifications via WebSocket. Encryption/decryption delegates to the caller's `TrustchainSDK` (compress → encrypt → base64 on write; reverse on read).

Also exports `getCloudSyncApi` (low-level fetch wrapper) and `makeCipher` (standalone encrypt/decrypt helper) for callers that need finer control.

Structural trustchain types (`Trustchain`, `MemberCredentials`, `TrustchainSDK`, …) are inlined here to keep `@ledgerhq/ledger-key-ring-protocol` out of this package's runtime deps.
