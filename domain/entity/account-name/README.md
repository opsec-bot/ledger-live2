# @domain/entity-account-name

RTK slice and WalletSync module for user-defined account names.

State shape: `accountNames: Map<string, string>` (accountId → name). Exports `accountNamesSlice`, actions (`setAccountName`, `bulkSetAccountNames`, `setNamesForAccounts`, `initFromUserData`), selectors (`accountNameSelector`, `accountNameWithDefaultSelector`) and `accountNamesSyncModule` — a `WalletSyncDataManager` that syncs account names across devices via `@shared/wallet-sync`.
