# Contextual Help (`el-contextual-help`)

[← Back to root README](../../../README.md)

---

## What it does

The help button in the [Navbar](../navbar/README.md). Clicking it opens the [validation panel](../validationPanel/README.md); clicking it again closes it. The button carries `aria-expanded`, which follows whether that panel is open.

Its icon says whether the viewed day's Diary can be submitted: a check mark when no hard check is failing (a failing soft check does not stop it), otherwise a question mark. With no active rules there is nothing to check, so it keeps the question mark. The accessible name follows: `Diary checks: ready to submit`, `Diary checks: not ready`, or just `Diary checks` with no active rules. It is re-evaluated on every store update, so it follows Entry edits and a change of viewed date.

## Custom element

`<el-contextual-help>`

## Attributes

| Attribute | Purpose                                   |
| --------- | ----------------------------------------- |
| `id`      | Used to build the help button's own `id`. |

## Store interaction

Reads `diaries` and `currentDate` and runs `validateDiary()` ([src/validation](../../validation/README.md)). Dispatches `SHOW_PANEL` with payload `'validation'`, or `HIDE_PANEL` when that panel is already open, and subscribes to the store to keep `aria-expanded` in step (see [store README](../../store/README.md)).

The Instructions item in the Navbar menu is the way back to the onboarding text; this button no longer opens it.

## Tests

`contextualHelp.test.js`.

---

[← Back to root README](../../../README.md)
