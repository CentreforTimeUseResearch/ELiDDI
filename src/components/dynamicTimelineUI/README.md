# Dynamic Timeline UI (`el-dynamic-timeline`)

[← Back to root README](../../../README.md)

---

## What it does

The JS-layer root component. `scripts/generate_no_js.js` wraps the entire no-JS diary form in an `<el-dynamic-timeline>` element (see the root README's [Architecture](../../../README.md#architecture) section); once JS loads, this component's `render()` replaces that no-JS form markup with the real interactive UI:

- [`<el-nav-bar>`](../navbar/README.md)
- [`<el-timeline-stack>`](../timelineStack/README.md)
- Two [`<el-dialog>`](../dialogWidget/README.md)s: one hosting [`<el-onboarding>`](../onboarding/README.md), one hosting [`<el-date-picker>`](../datePicker/README.md).

## Custom element

`<el-dynamic-timeline>` — no attributes or props; it's mounted once, wrapping the whole app.

## Store interaction

Subscribes to the store and opens/closes its two dialogs based on:

- `onboarding` (boolean) → the onboarding dialog.
- `uipanel === 'date'` → the date dialog.

Dismissing either dialog via its own close button dispatches `DISMISS_ONBOARDING` or `HIDE_PANEL` respectively, rather than the dialog just closing itself silently.

## Behaviour notes

- Marked in its own source comments as a work in progress.
- Registers each dialog's `registerDialogActions` callback into `onboardingDialogActions`/`dateDialogActions`, which is how it drives `open()`/`close()` on dialogs it doesn't otherwise hold a direct reference to — see [DialogWidget](../dialogWidget/README.md)'s props contract.

---

[← Back to root README](../../../README.md)
