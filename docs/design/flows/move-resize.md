# Flow: Move and resize

## Trigger

The Respondent drags an Entry block's body to move it in time, or drags one of its two edges (start or end) to change its length. Touch: long-press (~500 ms) arms the block, then drag. Keyboard: see [keyboard-interaction](keyboard-interaction.md).

## States

1. **Idle / selected**: selected Entry shows start and end handles. ![Selected](../screens/move-resize/01-selected.png)
2. **Armed (touch)**: after long-press the block lifts visibly and haptic/aria feedback confirms. ![Armed](../screens/move-resize/02-armed.png)
3. **Moving**: dragging the body shifts the whole Entry, keeping its duration, snapped to 10 minutes, with a live start-end readout. Adjoining Entries on single-choice Dimensions adjust live (see rules). ![Moving](../screens/move-resize/03-moving.png)
4. **Resizing**: dragging an edge changes that boundary only; the adjoining Entry's facing boundary moves with it so there is no gap and no overlap. Dragging into a gap simply extends into the gap. ![Resizing](../screens/move-resize/04-resizing.png)
5. **Limit reached**: the drag stops where a neighbour would fall under 10 minutes, where the dragged Entry would fall under 10 minutes, at the day edges, or at "now" on the current day. Signalled visibly and by text. ![Limit](../screens/move-resize/05-limit.png)
6. **Committed**: release applies the change as one step, and the handles stay up at the new position. ![Committed](../screens/move-resize/06-committed.png)
7. **Cancelled**: Escape or pointer cancel during a drag restores every affected Entry exactly. ![Cancelled](../screens/move-resize/07-cancelled.png)

## Rules (single-choice Dimensions)

- Resize edge: the neighbour that shares the boundary is trimmed or extended to match; a neighbour is never shrunk below 10 minutes and never deleted. If no neighbour touches the edge (a gap), nothing else changes.
- Move: when the block slides over a neighbour, the neighbour is trimmed on the facing side down to 10 minutes; beyond that the move stops. Whole Entries are never swapped, hidden or deleted.
- Multiple-choice Dimensions: Entries may overlap, so neighbours are not adjusted and only day edges, 10-minute minimum and "now" limit the drag.
- Past only: nothing may extend past "now" on the current day.

## Baseline behaviour without JavaScript

Not available as a gesture. The Respondent edits the card controls: set the new Activity on the earlier or later card, using "continued until next entry" to move where one Activity ends.

## Enhanced behaviour with JavaScript

- Pointer events with pointer capture; handles have an enlarged invisible hit area on touch; `touch-action` prevents scroll fighting once armed.
- Pointer-move updates a draft; only release dispatches. A move or resize that changes a neighbour is committed as a **batched dispatch** of one `UPDATE_ENTRY` per affected Entry, folded into one committed state with a single notification (see Decisions in the [README](../README.md)).
- A move or resize does not start while the details panel is open (the same rule as the handle drags): a typed, unsaved edit and a live drag are never in flight together. The Respondent finishes with Save or Cancel first; the panel's own time fields are the way to change times while it is open.
- Handles stay up while the Respondent presses their own Entry, one of its handles, or the details panel. Any other press (another Entry, empty time, another Timeline, the navbar, the page background) dismisses them, as does Escape.
- Diary status becomes in-progress on commit.

## Accessibility

- Handles are focusable with names "Start time handle, 12:30" and "End time handle, 13:00".
- Drag progress and limits are announced through a polite live region: "Moved to 12:40 to 13:10. Next entry now starts 13:10."
- Pointer drag is never the only way: the keyboard grab mode and the panel's time fields both change times.
- Reduced motion: no animated snapping or lift effect when `prefers-reduced-motion` is set.

## Acceptance criteria

- [ ] Body drag moves an Entry keeping its duration, snapped to 10 minutes.
- [ ] Edge drag changes only that edge of the Entry and the adjoining boundary of its neighbour.
- [ ] Single-choice Timelines never end up with an overlap or an Entry under 10 minutes.
- [ ] No Entry is deleted or swapped by a drag.
- [ ] Day edges and "now" stop the drag.
- [ ] Escape or pointer cancel restores all affected Entries exactly.
- [ ] Release commits all changes together.
- [ ] Touch requires long-press, so scrolling still works.
- [ ] A press anywhere except the handled Entry, its handles or the details panel hides the handles.
- [ ] Handles and results are reachable and announced without a pointer.
