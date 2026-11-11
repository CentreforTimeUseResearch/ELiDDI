# Submission Status (`el-submission-status`)

[← Back to root README](../../../README.md)

---

## What it does

The submission status button in the [Navbar](../navbar/README.md). Clicking it opens the [validation panel](../validationPanel/README.md); clicking it again closes it. The button carries `aria-expanded`, which follows whether that panel is open.

Its icon says whether the viewed day's Diary can be submitted: a check mark when no hard check is failing (a failing soft check does not stop it), otherwise a question mark. With no active rules there is nothing to check, so it keeps the question mark. The accessible name follows: `Diary checks: ready to submit`, `Diary checks: not ready`, or just `Diary checks` with no active rules. It is re-evaluated on every store update, so it follows Entry edits and a change of viewed date.

Not to be confused with `<el-sync-status>` ([`syncStatus`](../syncStatus/syncStatus.js)), which sits beside it in the nav bar when the study uses server accounts: that one says whether the Diary has been _saved to the server_ ("Saved", "Saving…"); this one says whether it is _ready to submit_.

Renamed from `ContextualHelp` / `el-contextual-help`; the question-mark icon file is still `help-252.svg` because that is what it depicts.

## Custom element

`<el-submission-status>`

## Attributes

None. The button inside it has the fixed id `submission-status-button` (there is only ever one in the nav bar).

## Store interaction

Reads `diaries` and `currentDate` and runs `validateDiary()` ([src/validation](../../validation/README.md)). Dispatches `SHOW_PANEL` with payload `'validation'`, or `HIDE_PANEL` when that panel is already open, and subscribes to the store to keep `aria-expanded` in step (see [store README](../../store/README.md)).

The Instructions item in the Navbar menu is the way back to the onboarding text; this button no longer opens it.

## Tests

`submissionStatus.test.js`.

---

[← Back to root README](../../../README.md)
