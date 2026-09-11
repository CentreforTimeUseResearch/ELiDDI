# Contextual Help (`el-contextual-help`)

[← Back to root README](../../../README.md)

---

## What it does

Renders a help/done icon button (shown in the [Navbar](../navbar/README.md)) intended to open a full-screen help popover pre-filled with the current onboarding instruction's text.

> **Work in progress.** The source is explicitly marked as a debug/placeholder render, and it depends on an `<el-help-popover>` element (`document.querySelector('el-help-popover')`) that does not currently exist anywhere in `src/`. This component will not function correctly until that element is implemented — a good first-contribution target if you're looking for one.

## Custom element

`<el-contextual-help>`

## Attributes

| Attribute | Purpose                                                           |
| --------- | ----------------------------------------------------------------- |
| `id`      | Used to build the help button's own `id` and its `popovertarget`. |

## Store interaction

Reads `onboarding` and `instructionStep` from the app store (see [store README](../../store/README.md)) once `<el-help-popover>` is defined, to decide whether to show the popover and what instruction text to display.

## Test file naming

`contextualHelp.te-st.js` — deliberately not run by Vitest yet (see the root README's note on `.te-st.js` vs `.test.js`), since there isn't a finished feature to assert against.

---

[← Back to root README](../../../README.md)
