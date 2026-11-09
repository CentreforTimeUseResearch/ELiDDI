# Flow: Create entry

## Trigger

The Respondent wants to record what they did in a period with no Entry on the current Dimension's Timeline: they click or tap empty time, or press-and-drag across it. (Keyboard: see [keyboard-interaction](keyboard-interaction.md).)

## States

1. **Idle**: Timeline shows existing Entries and empty time. ![Idle](../screens/create-entry/01-idle.png)
2. **Hover (pointer only)**: the 10-minute slot under the pointer is lightly highlighted. ![Hover](../screens/create-entry/02-hover.png)
3. **Dragging**: pressing on empty time and moving paints a provisional block from the press slot to the current slot, snapped to 10 minutes, in either direction. A readout shows start, end and duration. ![Dragging](../screens/create-entry/03-dragging.png)
4. **Clamped**: the block stops at the nearest existing Entry on a single-choice Dimension, at the day edges, and at "now" on the current day. The limit is signalled visibly (as the resize limit flash today). ![Clamped](../screens/create-entry/04-clamped.png)
5. **Panel open (new)**: on release, the provisional block stays and the shared details panel opens with start and end filled in and the activity empty. ![Panel](../screens/create-entry/05-panel-open.png)
6. **Saved**: Save is enabled once an Activity is chosen; saving turns the block into an Entry and closes the panel. ![Saved](../screens/create-entry/06-saved.png)
7. **Cancelled**: Escape, Cancel or dismissing the panel removes the provisional block; the Diary is unchanged. ![Cancelled](../screens/create-entry/07-cancelled.png)

A plain click or tap (press and release without moving past one slot) creates a default-length block (30 minutes, proposed) starting at the clicked slot, clamped to free space, and goes straight to state 5. If less than 10 minutes is free there, nothing is created and the limit is signalled.

## Baseline behaviour without JavaScript

The server-rendered form has one card per 10-minute slot, each with a control per Dimension (`<select>`, text input with datalist, or checkbox group). To record a period the Respondent sets the control on the first card of the period and ticks "continued until next entry" so the choice carries forward until another card changes it. Skip links move by 10 minutes and 1 hour. Nothing is saved until the form is submitted.

## Enhanced behaviour with JavaScript

- `<el-dynamic-timeline>` replaces the form; gestures operate on the Timeline for the current Dimension.
- Pointer events with pointer capture; on touch, a short press-and-drag on empty time creates, while a drag that starts as a scroll gesture scrolls the Timeline (create requires the slot to be pressed without scrolling for ~150 ms, so scrolling is never hijacked).
- Created Entries on single-choice Dimensions never overlap another Entry. On multiple-choice Dimensions the block may overlap and is not clamped by neighbours.
- Changes mark the Diary status in-progress.

## Accessibility

- Empty time is exposed as focusable slot buttons (roving tabindex), each labelled with its time, e.g. "Add entry at 09:10, Primary activity".
- Provisional block is announced via a polite live region: "New entry 09:10 to 09:40, 30 minutes".
- Focus moves to the panel's Activity field on open; on save or cancel it returns to the new Entry's block (or the originating slot on cancel).
- The panel is a labelled dialog region; Escape closes it.
- Clamp limits are announced ("Limited by next entry at 09:40"), not by colour or flash alone.
- Pointer targets at least 24x24 CSS px (WCAG 2.2 AA).

## Acceptance criteria

- [ ] Dragging across empty time paints a block snapped to 10-minute slots, in both directions.
- [ ] Block clamps to neighbours (single-choice), day edges, and "now" on the current day.
- [ ] A single click or tap creates a 30-minute (or shorter, if clamped) block and opens the panel.
- [ ] Release opens the panel with start and end pre-filled; Save needs an Activity.
- [ ] Escape, Cancel or dismissal leaves no trace of the block and does not change the Diary.
- [ ] Touch scrolling is never blocked by the create gesture.
- [ ] No overlap is ever created on a single-choice Dimension.
- [ ] Without JavaScript the same period can be recorded using the card controls and "continued until next entry".
- [ ] Every step is possible by keyboard and announced to a screen reader.
