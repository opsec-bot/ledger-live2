---
"live-mobile": patch
---

Fix Swap: pressing "<" from the History screen after a multi-step swap now reliably returns to the initial input form. Replaced `navigate` with `StackActions.replace` so the swap webview is fully unmounted rather than left in a detached state where native back navigation could resume the success screen.
