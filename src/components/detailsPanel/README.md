# Details Panel (`el-details-panel`)

[← Back to root README](../../../README.md)

---

## What it does

The panel used to create or edit one Entry on the currently-active Dimension's Timeline. One instance is mounted per Dimension (by [Timeline](../timeline/README.md), one per Dimension's `<el-timeline>`), and the app store's `uipanel`/`currentDimensionIndex` decide which single instance is actually visible at a time.

It composes:

- [`<el-activity-picker>`](../activityPicker/README.md) — choose the Activity/Activities.
- [`<el-time-picker-panel>`](../timePickerPanel/README.md) — set start/end time or duration.
- A Save button, a Delete button (hidden until editing an existing Entry), and an error region.

Terminology (Dimension, Timeline, Entry, Activity, Day boundary) follows [CONTEXT.md](../../../CONTEXT.md).

## Custom element

`<el-details-panel dimensionindex="…" heading="…" instruction="…">`

## The `panelActions` contract

Timeline never calls DetailsPanel's methods directly. Instead, on connect, DetailsPanel calls a `registerPanelActions` prop it receives, handing Timeline a small named set of callbacks it's allowed to invoke:

| Action                          | Purpose                                                                |
| ------------------------------- | ---------------------------------------------------------------------- |
| `openEntry(entry)`              | Pre-fill the panel to edit an existing Entry.                          |
| `openNewEntry(startOffsetMins)` | Reset the panel and pre-fill just a start time, for a brand new Entry. |
| `close()`                       | Reset the panel's state.                                               |
| `reportSaveConflict(message)`   | Show a save-time validation error (e.g. an overlapping Entry).         |

This keeps Timeline decoupled from DetailsPanel's actual method names — a rename on either side can't silently desync the other.

DetailsPanel, in turn, receives (via props) `saveEntry(entry)`, `deleteEntry(id)`, and `findNextEntryAfter(offsetMins)` from Timeline, plus a `registerPanelActions` callback to complete the handshake.

## Store interaction

- Reads `currentDimensionIndex` to decide whether it's the panel that should currently be visible.
- Subscribes to the store and shows/hides itself in response to `uipanel === 'activity'`.
- Dispatches `SHOW_PANEL`/`HIDE_PANEL` when its own open/close button is used.

## Behaviour notes

- Times are stored internally as `startOffsetMins`/`endOffsetMins` (minutes since the Day boundary — see [ADR-0001](../../../docs/adr/0001-day-boundary-not-midnight.md)), but the time picker widgets work in absolute clock-time minutes; `dayBoundaryInMinutes` (derived from `GLOBALS.DATA.day_boundary`) is added/subtracted at the boundary between the two.
- `getContinueToTarget(startTimeInMinutes)` implements the "continue this activity" checkbox in the time picker: it continues to the next chronological Entry if one exists after the given start time, otherwise to the end of the diary day.
- The Save button only becomes enabled once `isEntryComplete()` is true (valid start/end time and at least one Activity selected).

---

[← Back to root README](../../../README.md)
