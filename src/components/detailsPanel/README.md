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

| Action                                          | Purpose                                                                                                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `openEntry(entry)`                              | Pre-fill the panel to edit an existing Entry.                                                                                           |
| `openNewEntry(startOffsetMins, endOffsetMins?)` | Reset the panel and pre-fill the start and end times, for a brand new Entry. The end defaults to one slot (10 minutes) after the start. |
| `close()`                                       | Reset the panel's state.                                                                                                                |
| `focus()`                                       | Move keyboard focus into the panel (the activity field). A Timeline calls it after Enter opens an Entry or a new block.                 |
| `hasUnsavedEdits()`                             | Whether the panel holds something changed that has not been saved (see below). Asking it changes nothing.                               |
| `reportSaveConflict(message)`                   | Show a save-time validation error (e.g. an overlapping Entry).                                                                          |

This keeps the Timelines decoupled from DetailsPanel's actual method names — a rename on either side can't silently desync the other.

DetailsPanel, in turn, receives (via props) `saveEntry(entry)`, `deleteEntry(id)`, and `findNextEntryAfter(offsetMins)`, which the coordinator routes to the current Dimension's Timeline, plus the `registerPanelActions` callback that completes the handshake.

## Unsaved edits

The panel records what it was **opened with** (its baseline): `openEntry` records the Entry as stored, `openNewEntry` the start and end it was given, and `reset()` forgets it. `hasUnsavedEdits()` is true when the start, end or activity now differ from that. So an Entry just opened is not unsaved, nor is a new block just dragged out and given nothing else (nothing the Respondent chose would be lost), and changing something back makes it not unsaved again. Several activities (a multiple-choice Dimension) compare as a set, in any order; no activity, an empty one and an empty list are the same.

The [coordinator](detailsPanelCoordinator.js) parks and restores a draft across a Dimension switch through `getDraft()` / `restoreDraft()`, which carry the baseline with the state, so a restored draft is still known to be unsaved (or not). A parked draft is checked with `isDraftUnsaved(draft)`.

## Asking before an unsaved edit is lost

Nothing unsaved is dropped silently. The things that would drop it (opening another Entry or an empty slot, starting a new Entry, changing day, and the panel's own Escape and chevron) call `guardUnsavedEdits(scope, proceed, onCancel)` in [`utils/unsavedEdits.js`](../../utils/unsavedEdits.js) instead of going ahead. The [coordinator](detailsPanelCoordinator.js) registers itself as the guard (`registerGuard()`, called by both stacks), and:

- With nothing unsaved, `proceed` runs at once. (Closing also resets the panel, so no stale draft is left in a hidden panel.)
- With something unsaved, the panel shows an in-panel question (`showLeavePrompt`, a labelled `role="group"`, not a browser dialog): "You have unsaved changes to this entry." with **Save**, **Discard** and **Keep editing**. Focus goes to **Keep editing** (the safe one), which is described by the question, and the question is announced politely.
- **Save** is offered only if the entry is complete; otherwise the group says "It can't be saved yet." with the reason, and only Discard and Keep editing are shown. Save goes through the normal save (`saveDraft()`), so an overlap error shows and nothing is lost (the original action is then cancelled, as for Keep editing); on success `proceed` runs. **Discard** drops the draft (`reset()`) and `proceed` runs. **Keep editing**, or **Escape**, calls `onCancel`, leaves the draft as it was and puts focus back where it was.
- `scope` says what could be lost: `{ dimensionIndex }` (an open into that Dimension: the panel's own draft, or one parked for it) or `{ all: true }` (a change of day: every Dimension's draft). A Dimension switch is **not** asked about, since its draft is parked; a restored draft counts as unsaved. For a draft parked in another Dimension, that Dimension is brought forward first so the Respondent can see what is being asked about; with several, they are asked one at a time.
- Callers do their own visible work only in `proceed` (the Timeline's selection and the new-Entry block change when the open goes ahead, and the day does not change until then), and undo anything done in advance in `onCancel` (the date picker puts its input back).

The question itself — its markup, show/hide, answers and focus bookkeeping — is `LeavePromptFlow` (`leavePromptFlow.js`), a plain class the panel owns; the panel's `showLeavePrompt` cancels any pending delete question (only one shows at a time) and hands over to it.

## Save when the entry is not complete

Save is **`aria-disabled="true"`**, not `disabled`, and also faded (the `opaque` class). It stays focusable, so a keyboard user can find it, and a click on it is not swallowed. A hint (`.save-hint`, visible text, not an error) says what is missing, in words: "Choose an activity", "An entry must last at least 10 minutes", "Choose a start and end time", joined if there is more than one; Save's `aria-describedby` points at it (and at the panel's own message area, `.entry-error`, for save conflicts, while that has something to say). When the entry is complete the hint goes and Save works. Pressing it while incomplete saves nothing and takes focus to what needs doing: the activity field, else the end time (or the start time if times are missing). The hint and message ids include a per-panel number, as `aria-describedby` needs ids.

The time and duration fields already tie their own error to the field with `aria-describedby` and announce it politely; a test keeps that from regressing.

## Deleting

Delete does not delete: it **asks first, in the panel** (no browser `confirm`, no dialog). Pressing it hides Save, its hint and Delete, and shows a labelled group (`role="group"`, named by its question) in their place: "Delete this entry? This can't be undone." with **Delete** (outlined, danger) and **Keep it** (filled, the safe answer). Focus goes to **Keep it**, which is also described by the question, so a screen reader reads it with the choice.

- **Delete** removes the Entry through `deleteEntry(id)` once (the question is answered, so a second press or a double-click cannot delete again). The Timeline then closes the panel and puts focus on the empty slot where the Entry was ([`BaseTimeline.deleteEntry`](../timeline/baseTimeline.js)), whether the panel was opened with a mouse or a key, since the Delete button that had focus is gone.
- **Keep it**, or **Escape**, goes back to Save and Delete with focus on Delete. That Escape answers the question and does **not** also close the panel; the next one does.
- An unanswered question does not wait: it is dropped when another Entry is opened (`openEntry`), a new one is started or the panel is reset (a Dimension or day change, a save), or the panel is hidden, so it never comes back unasked. If the Entry turns out to have gone already, the question is put away rather than left on screen.
- Only the Entry open in the panel can be asked about; a new, unsaved one has no Delete.

The question itself is `DeleteConfirmFlow` (`deleteConfirmFlow.js`), a plain class the panel owns, injected with the three things it can't know: which Entry id is open, how to delete it, and where focus returns on Keep it.

## Keyboard

Escape closes the panel, like its close button (`HIDE_PANEL`), except that when the activity list is open that Escape is for closing the list: the next one closes the panel. The list is only known to be open from its popover (`:popover-open`), because the combobox's `aria-expanded` is never set to true, and the list opens as soon as the field is focused, so the panel notes in the capture phase whether it was open, lets the list's own handling run, and closes the list itself if that left it open.

## Store interaction

- Subscribes to the store and shows/hides itself in response to `uipanel === 'details'`.
- Dispatches `SHOW_PANEL`/`HIDE_PANEL` when its own open/close button is used.

## Behaviour notes

- Times are stored internally as `startOffsetMins`/`endOffsetMins` (minutes since the Day boundary — see [ADR-0001](../../../docs/adr/0001-day-boundary-not-midnight.md)), but the time picker widgets work in absolute clock-time minutes; `dayBoundaryInMinutes` (the study config's `day_boundary`, via `utils/time.js`) is added/subtracted at the boundary between the two.
- `getContinueToTarget(startTimeInMinutes)` implements the "continue this activity" checkbox in the time picker: it continues to the next chronological Entry if one exists after the given start time, otherwise to the end of the diary day.
- The Save button only becomes enabled once `isEntryComplete()` is true (valid start/end time and at least one Activity selected).

---

[← Back to root README](../../../README.md)
