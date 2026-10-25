# Details Panel (`el-details-panel`)

[← Back to root README](../../../README.md)

---

## What it does

The panel used to create or edit one Entry on the current Dimension's Timeline. The app has **one** of these, in the mobile and desktop layouts alike ([ADR 0005](../../../docs/adr/0005-one-details-panel-in-every-layout.md)). The stack that owns the Timelines ([TimelineStack](../timelineStack/README.md) or [HorizontalTimelineStack](../horizontalTimelineStack/README.md)) creates it through a `DetailsPanelCoordinator` (`detailsPanelCoordinator.js`), which retargets it to whichever Dimension is current, however that changes (a swipe, the Timeline picker, a click on another row), and keeps an unsaved draft per Dimension: switching away parks it, switching back restores it, and saving, deleting or a date change ends it. Where the panel sits is each stack's CSS: below the swipe strip on mobile, docked right on desktop.

It composes:

- [`<el-activity-picker>`](../activityPicker/README.md) — choose the Activity/Activities.
- [`<el-time-picker-panel>`](../timePickerPanel/README.md) — set start/end time or duration.
- A Save button, a Delete button (hidden until editing an existing Entry), and an error region.

Terminology (Dimension, Timeline, Entry, Activity, Day boundary) follows [CONTEXT.md](../../../CONTEXT.md).

## Custom element

`<el-details-panel dimensionindex="…" heading="…" instruction="…">`

## The `panelActions` contract

Nothing calls DetailsPanel's methods directly. Instead, on connect, DetailsPanel calls a `registerPanelActions` prop it receives, handing the coordinator a small named set of callbacks; the coordinator gives each Timeline its own `panelActions` with the same names, which route through it (switching Dimension and opening the panel first):

| Action                          | Purpose                                                                |
| ------------------------------- | ---------------------------------------------------------------------- |
| `openEntry(entry)`              | Pre-fill the panel to edit an existing Entry.                          |
| `openNewEntry(startOffsetMins)` | Reset the panel and pre-fill just a start time, for a brand new Entry. |
| `close()`                       | Reset the panel's state.                                               |
| `reportSaveConflict(message)`   | Show a save-time validation error (e.g. an overlapping Entry).         |

This keeps the Timelines decoupled from DetailsPanel's actual method names — a rename on either side can't silently desync the other.

DetailsPanel, in turn, receives (via props) `saveEntry(entry)`, `deleteEntry(id)`, and `findNextEntryAfter(offsetMins)`, which the coordinator routes to the current Dimension's Timeline, plus the `registerPanelActions` callback that completes the handshake.

## Store interaction

- Subscribes to the store and shows/hides itself in response to `uipanel === 'details'`.
- Dispatches `SHOW_PANEL`/`HIDE_PANEL` when its own open/close button is used.

## Behaviour notes

- Times are stored internally as `startOffsetMins`/`endOffsetMins` (minutes since the Day boundary — see [ADR-0001](../../../docs/adr/0001-day-boundary-not-midnight.md)), but the time picker widgets work in absolute clock-time minutes; `dayBoundaryInMinutes` (derived from `GLOBALS.DATA.day_boundary`) is added/subtracted at the boundary between the two.
- `getContinueToTarget(startTimeInMinutes)` implements the "continue this activity" checkbox in the time picker: it continues to the next chronological Entry if one exists after the given start time, otherwise to the end of the diary day.
- The Save button only becomes enabled once `isEntryComplete()` is true (valid start/end time and at least one Activity selected).

---

[← Back to root README](../../../README.md)
