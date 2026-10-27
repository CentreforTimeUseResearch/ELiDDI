# Contextual Help (`el-contextual-help`)

[← Back to root README](../../../README.md)

---

## What it does

The help button in the [Navbar](../navbar/README.md). Clicking it opens the [validation panel](../validationPanel/README.md); clicking it again closes it. The button carries `aria-expanded`, which follows whether that panel is open.

## Custom element

`<el-contextual-help>`

## Attributes

| Attribute | Purpose                                   |
| --------- | ----------------------------------------- |
| `id`      | Used to build the help button's own `id`. |

## Store interaction

Dispatches `SHOW_PANEL` with payload `'validation'`, or `HIDE_PANEL` when that panel is already open, and subscribes to the store to keep `aria-expanded` in step (see [store README](../../store/README.md)).

The Instructions item in the Navbar menu is the way back to the onboarding text; this button no longer opens it.

## Tests

`contextualHelp.test.js`.

---

[← Back to root README](../../../README.md)
