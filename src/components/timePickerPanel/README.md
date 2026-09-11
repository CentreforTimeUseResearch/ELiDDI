# Time Picker Panel (`el-time-picker-panel`)

[← Back to root README](../../../README.md)

---

## What it does

Composes a start-time [`<el-time-picker>`](../timePicker/README.md), an end-time `<el-time-picker>`, a "continue this activity to the end of the day" checkbox, and an [`<el-duration-input>`](../durationInput/README.md), keeping all three representations of "when this Entry happens" (start, end, duration) consistent with each other as any one of them changes. Used inside [DetailsPanel](../detailsPanel/README.md).

Terminology (Entry, Day boundary) follows [CONTEXT.md](../../../CONTEXT.md).

## Custom element

`<el-time-picker-panel day-boundary="…" start-time="…" end-time="…">`

| Attribute                 | Purpose                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `day-boundary`            | The Day boundary, in minutes-since-midnight-plus-a-day offset form (see below).                                                                |
| `start-time` / `end-time` | Set externally by DetailsPanel (e.g. when opening an existing Entry) to pre-fill the pickers; changing either attribute recalculates duration. |

## Props

| Prop                                      | Type     | Purpose                                                                                                                                                             |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onTimeSet({ timeField, timeInMinutes })` | function | Called whenever start time, end time, or duration changes, so DetailsPanel can keep its own Entry-in-progress state up to date.                                     |
| `getContinueToTarget(startTimeInMinutes)` | function | Asks DetailsPanel what "continue to end of day" should resolve to (see [DetailsPanel](../detailsPanel/README.md#behaviour-notes)); also used to label the checkbox. |

## Behaviour notes

- All internal math is done in absolute clock-time minutes (`0`–`1439`, or beyond `1440` for a span that crosses midnight relative to the Day boundary), then converted to/from the Entry's boundary-relative `startOffsetMins`/`endOffsetMins` at the point it talks to DetailsPanel — see [ADR-0001](../../../docs/adr/0001-day-boundary-not-midnight.md) for why the Day boundary isn't midnight.
- `onTimeInputChange` explicitly coerces its `valueInMinutes` argument to a `Number`, because it arrives as a genuine number from a typed/picked time or the "continue to end of day" checkbox, but as a _string_ when it comes via the `start-time`/`end-time` HTML attribute (HTML attributes are always strings) — e.g. when DetailsPanel reopens a previously-saved Entry.
- `recalculateDuration` adds 24 hours to the end time internally when it's earlier than the start time, to correctly compute the duration of a span that crosses midnight.

---

[← Back to root README](../../../README.md)
