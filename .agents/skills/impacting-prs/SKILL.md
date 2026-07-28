---
name: impacting-prs
description: Study which open PRs are impacted by a migration/sunset/refactor we just merged into develop (or are about to), explain the concrete impact per PR, and post tailored comments — blocking review when critical, heads-up otherwise. Use when asked to check/flag/notify open PRs about a breaking change, deprecation or migration they need to follow.
---

# Notify open PRs impacted by an ongoing migration

**When:** a change landed in `develop` (or is coming) that every in-flight PR must follow — a package sunset, an API deprecation, a moved module, a new architectural rule. Goal: tell each impacted author, in their own PR, what they will have to do — and block the PR when the breakage is already in `develop`.

**Two hard rules:**

- 🚫 Never post anything before the user has read and approved the drafts.
- 🚫 Never guess the migration pattern. Derive it from the merged work, then have the user confirm it (step 1).

## 1. Pin down the change and the migration pattern

Ask the user for what only they know (use `AskUserQuestion`, batched):

- **On whose behalf** we speak (the person who did the migration) — the comments are written for them.
- **The merged/prepared PRs** implementing the migration, and a migration guide/ADR if one exists.
- **Status per artifact**: already dropped (→ blocking) vs deprecated-but-alive (→ heads-up).

Then do the homework yourself, don't ask for it:

```bash
gh pr diff <migration-pr>                       # the actual before → after
gh pr list --state merged --author <login> --limit 30 --json number,title,mergedAt
gh api repos/$GH_REPO/commits?path=<dropped-path> --jq '.[].commit.message'
```

Read enough of the merged diffs to answer: **how do I detect the problem in a diff**, and **what exactly replaces it, per layer**. The replacement is rarely uniform — e.g. a public lib may not import an app-internal domain module, while `libs/coin-modules/*` reach the same data through the coin framework. Build a matrix:

| Layer / path | Detection signal (added lines) | Replacement | Severity |
| --- | --- | --- | --- |
| `apps/**` | `from "@x/dropped"` | `useFoo()` from `@x/new` | 🔴 blocking |
| `libs/coin-modules/**` | same import | `coinConfig.getStore()` | 🔴 blocking |
| any | `from "@x/deprecated-types"` | `@x/new-types` | 🟠 heads-up |

**Show the matrix and the severity policy to the user and get an explicit OK before scanning.** Also agree on the detection regex — a too-broad one produces noise, and noise on 20 PRs is expensive.

## 2. Select eligible PRs

Only PRs that **target `develop`** and are **not already conflicting** — a conflicting PR has to rebase anyway, and will pick the change up then. `scan-prs.sh` handles the selection and the diff scan (~15s for 50 PRs):

```bash
.agents/skills/impacting-prs/scan-prs.sh -p 'cryptoassets' -o "$TMPDIR/scan"
# -p regex (required, matched on added lines only)  -b base (develop)  -l list limit
# -j parallel jobs  -x excluded-paths regex  -o output dir
```

It writes `prs.json` (eligible PRs), `diffs/<n>.diff`, `hits.tsv` (`pr ⇥ path ⇥ line ⇥ content`) and prints the skip counts. `line` is the **RIGHT-side line number**, ready to use as the `line` of a review comment — anchor on it rather than recomputing. Notes:

- Matching **added lines only** matters: a PR that *removes* the old import is doing the migration, not breaking it.
- GitHub computes mergeability lazily — the first `gh pr list` returns `UNKNOWN` for most PRs and warms the cache; the script queries twice for that reason. Re-run if some stay `UNKNOWN`.
- Run `gh` **outside the sandbox** (`dangerouslyDisableSandbox: true`).

## 3. Analyse each hit

For every PR with hits, read the surrounding diff (`$OUT/diffs/<n>.diff`) and decide:

- **False positive?** Drop it: moved/renamed lines, comments, changesets, fixtures, generated files, code that was already there, or a usage the matrix explicitly allows.
- **Which layer** the file belongs to → which row of the matrix applies → severity.
- **What the author must do**, in one sentence, referring to their own file paths and symbols.
- **The exact line to comment on**, from `hits.tsv` — every surviving hit becomes an inline comment, not a paragraph in a wall of text.
- **Is the replacement mechanical?** Then attach a ` ```suggestion ` block the author can commit in one click. Only when you can write the *exact* resulting line(s) — a wrong suggestion is worse than none, and a suggestion is a claim we are sure, so keep the hedging in the prose around it.

Keep a table: PR · author · what it is about · files · severity · required action. Verify a couple of the target APIs actually exist on `develop` before recommending them (`rg` in the repo) — recommending a symbol that does not exist destroys the credibility of the whole batch.

## 4. Draft and get approval

One comment per PR, from the templates in [references/comment-templates.md](references/comment-templates.md). Tone: on behalf of the migration author, **hedged** ("it looks like", "you may need to") — we are never 100% sure, the author knows their code better. Nice, short, actionable, and open to being wrong.

Show all drafts to the user in one message, grouped by severity, and wait. Expect the user to correct the expected code change — fold their corrections back into the matrix and re-check the other drafts against it.

## 5. Post

**Default form: one review carrying a short summary body + one inline comment per hit** (with a `suggestion` block where relevant). Anchored comments land next to the offending line, so the author sees the impact in their own code instead of in a wall of text — see [references/comment-templates.md](references/comment-templates.md) for the payload.

```bash
# event: REQUEST_CHANGES for 🔴 blocking, COMMENT for 🟠 heads-up (does not block)
gh api repos/$GH_REPO/pulls/<n>/reviews --input payload.json --jq .html_url
```

Sequentially, out of the sandbox, capturing each returned URL. Fallbacks:

- `422 line must be part of the diff` → the hit is outside the PR's own hunks; drop that inline comment (keep it in the body) rather than retrying on another line.
- `REQUEST_CHANGES` on your own PR is rejected by GitHub → post with `event: COMMENT` and say in the body that it would otherwise be blocking.
- No inline anchor at all (nothing mechanical, or all 422s) → `gh pr comment <n> --body-file draft.md`.

Do not re-post on a PR that already carries our comment — check `gh pr view <n> --json comments,reviews`.

## 6. Recap

Report back a copy-pasteable summary, grouped by severity, each line linking the **posted comment** (the URL returned above, e.g. `#issuecomment-…` / `#pullrequestreview-…`) plus a 2-4 word label of what the PR is about:

```
:red_circle: Blocking (@x/dropped removed from develop)
- #19806 (<comment url>) — Kaspa coin tester
- #19645 (<comment url>) — Readiness + Tezos

:large_orange_circle: Deprecated (@x/deprecated-types)
- #20034 (<comment url>) — Polkadot
```

List separately what was skipped and why (conflicting, other base, false positive) so the user can double-check the blind spots.
