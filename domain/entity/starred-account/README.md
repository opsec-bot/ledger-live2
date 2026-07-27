# @domain/entity-starred-account

RTK slice for starred (pinned) accounts.

State shape: `starredAccountIds: Set<string>`. Exports `starredAccountsSlice`, actions (`setAccountStarred`, `initStarredFromIds`) and selector `isStarredAccountSelector`.
