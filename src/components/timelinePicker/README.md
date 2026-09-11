# Timeline Picker (`el-timeline-picker`)

[← Back to root README](../../../README.md)

---

## What it does

A `<select>` dropdown of Dimension names (Primary activity, Secondary activity, Location, Who, Device, Enjoyment), shown in the [Navbar](../navbar/README.md), for switching which Dimension's Timeline is currently being viewed/edited.

Terminology (Dimension, Timeline) follows [CONTEXT.md](../../../CONTEXT.md).

## Custom element

`<el-timeline-picker>` — no attributes or props; Dimension names come straight from `GLOBALS.DATA.timeline`.

## Store interaction

- Reads and reacts to `currentDimensionIndex`.
- On change, dispatches `HIDE_PANEL` then `SWITCH_DIMENSION`.

## Behaviour notes

- Test file naming: `timelinePicker.te-st.js`, not currently run by Vitest (see the root README's note on `.te-st.js` vs `.test.js`).

---

[← Back to root README](../../../README.md)
