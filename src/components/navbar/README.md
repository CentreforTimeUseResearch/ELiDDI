# Navbar (`el-nav-bar`)

[← Back to root README](../../../README.md)

---

## What it does

The top navigation bar: a hamburger menu (Instructions / Reset), the [Timeline Picker](../timelinePicker/README.md) for switching Dimension, a date indicator/button that opens the date-change modal, and the [Contextual Help](../contextualHelp/README.md) button.

## Custom element

`<el-nav-bar>` — no attributes or props.

## Store interaction

- Subscribes to the store to keep the date indicator text in sync with `currentDate`.
- Dispatches `RESET_ONBOARDING` (Instructions menu item) and `SHOW_PANEL` with payload `'date'` (date button).

## Behaviour notes

- "Work in progress" per its own source comments — the off-screen hamburger menu's "Reset" item has no handler wired up yet.

---

[← Back to root README](../../../README.md)
