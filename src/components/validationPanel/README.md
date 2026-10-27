# Validation panel (`el-validation-panel`)

[← Back to root README](../../../README.md)

---

## What it does

A panel that slides in from the right-hand side (the Navbar's off-screen menu, mirrored) and lists the study's active Validation rules for the viewed day's Diary. Each rule shows a tick (passed) or a cross (failed), with visually hidden "passed" / "failed" text, and a failed rule says what is wrong. A **soft** rule is marked "(advice)". Terminology follows [CONTEXT.md](../../../CONTEXT.md).

The results come from `validateDiary()` ([src/validation](../../validation/README.md)) and are redrawn while the panel is open, whenever the Diary changes. Only rules that are `soft` or `hard` in `GLOBALS.DATA.validation` are listed; with none, the panel says no checks are set for this study.

## Diary complete

At the bottom is the "Diary complete" button. It is shown only when the study has `general.submit_completed_diary_url` (the rules above work either way).

- It is **disabled** while a **hard** check fails, and the panel says why (the button's `aria-describedby`). A failing soft check does not disable it.
- Clicking it with every check passing calls `submitDiary()` ([src/submission](../../submission/README.md)) for the viewed day.
- Clicking it with soft checks failing first opens a confirm dialog (an `<el-dialog>` inside the panel) that lists each failed soft check and asks "Are you sure?". "Submit anyway" calls `submitDiary()`; "Go back", or Escape, closes it and sends nothing. Escape in that dialog does not also close the panel.
- What happens after the call (success, error, redirect) is not handled yet: the result is only logged.

## Custom element

`<el-validation-panel>` — no attributes or props. [DynamicTimelineUI](../dynamicTimelineUI/README.md) mounts one.

## Opening and closing

Through the store's `uipanel` (value `'validation'`), so opening any other panel closes this one. The [help button](../contextualHelp/README.md) toggles it; Escape, the close button and a click outside the panel also close it (a click on the help button is not "outside"). It also closes when the onboarding dialog is shown.

## Accessibility

- A `<section>` labelled by its heading (`aria-labelledby`).
- Focus moves to the panel on open and back to the help button on close.
- While closed the panel is `inert`, so it is out of the tab order.
- Pass and fail are shown by icon and hidden text, not colour alone.
- Rule messages can contain Activity names typed by the Respondent, so they are escaped.

## Store interaction

Reads `uipanel`, `onboarding`, `currentDate` and `diaries`; dispatches `HIDE_PANEL`. It does not dispatch anything when submitting yet.

## Tests

`validationPanel.test.js`.

---

[← Back to root README](../../../README.md)
