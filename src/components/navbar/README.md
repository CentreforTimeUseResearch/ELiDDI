# Navbar (`el-nav-bar`)

[← Back to root README](../../../README.md)

---

## What it does

The top navigation bar: a hamburger menu (Instructions / Reset), the [Timeline Picker](../timelinePicker/README.md) for switching Dimension, a date indicator/button that opens the date-change modal, and the [Contextual Help](../contextualHelp/README.md) button.

## Custom element

`<el-nav-bar>` — no attributes or props.

## Store interaction

- Subscribes to the store to keep the date indicator text in sync with `currentDate`.
- With server accounts on (`general.server_accounts`), the menu also has a "Log out (switch person)" item, which first sends anything the server lacks and then ends the login on this device and on the server (see [Login](../login/README.md); if the changes cannot be sent, `<el-sync-notice>` asks the Respondent what to do). Without accounts it is not rendered. With accounts on, the right of the nav bar also has `<el-sync-status>`, a polite live region reading "Saved", "Saving…", "Not saved yet - will retry" or "Could not save to the server - your diary is kept on this device" (from `src/sync/syncStatus.js`; see the [sync README](../../sync/README.md)).
- Dispatches `RESET_ONBOARDING` (Instructions menu item), `SHOW_PANEL` with payload `'date'` (date button) and `SHOW_PANEL` with payload `'reset'` (Reset menu item). Reset clears nothing itself: [DynamicTimelineUI](../dynamicTimelineUI/README.md)'s confirm dialog dispatches `CLEAR_DIARY` for the viewed day.

## Behaviour notes

- "Work in progress" per its own source comments — the other menu items (View stats, About this study) have no handler wired up yet.

---

[← Back to root README](../../../README.md)
