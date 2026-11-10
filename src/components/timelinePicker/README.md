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
- Starts on the current Dimension (it used to show the first until something changed), and follows the store by selecting the matching option in the **same** `<select>`. It used to rebuild the `<select>` on every change, which dropped keyboard focus, so a keyboard user could not keep arrowing through the Dimensions.

## Behaviour notes

- It is a native `<select>` named "Dimension" (`aria-label`): that already exposes its role and value, and arrow-key behaviour, on a phone. The desktop layout's Dimension row labels are a tab list instead (see [HorizontalTimelineStack](../horizontalTimelineStack/README.md)).

---

[← Back to root README](../../../README.md)
