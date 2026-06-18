---
"@ledgerhq/live-common": patch
"ledger-live-desktop": patch
"live-mobile": patch
---

Migrate the swap `fetchQuotes` helper from axios to an RTK Query endpoint (`swapQuotesApi`). The aggregator `/quote` request now flows through the Redux data layer; the request, the rawQuotes/providerErrors split, and the swallow-HTTP-errors behaviour are unchanged. Each app registers the new API and injects its store dispatch at startup via `setSwapQuotesStore`.
