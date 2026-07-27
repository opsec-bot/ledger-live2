---
"@ledgerhq/coin-polkadot": minor
"@ledgerhq/live-common": patch
---

Remove the deprecated `CurrencyBridge.preload`/`hydrate` from `coin-polkadot`. Polkadot validators, staking progress and minimum bond balance are now fetched on demand (with LRU caching in the network layer) instead of being eagerly preloaded at app init, which was slowing down the scan-account flow.
