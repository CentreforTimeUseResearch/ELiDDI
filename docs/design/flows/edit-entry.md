# Flow: Edit entry

## Trigger

The Respondent clicks or taps an existing Entry block (or activates it by keyboard) to change its Activity, times, or to delete it.

## States

1. **Idle**: Entry blocks displayed with colour and short label. ![Idle](../screens/edit-entry/01-idle.png)
2. **Hover / focus**: the block shows a hover or focus indication and, on desktop, a tooltip with Activity, start, end. ![Hover](../screens/edit-entry/02-hover.png)
3. **Selected + panel open**: the block is marked selected; the shared details panel opens (bottom panel on narrow screens, right dock on desktop) showing Activity, start, end, duration. Edge handles appear on the block. ![Selected](../screens/edit-entry/03-selected-panel.png)
4. **Editing**: changing Activity, start, end or duration updates a live preview on the block. Invalid input (below 10 minutes, overlap on a single-choice Dimension, beyond "now") shows an inline message and disables Save. ![Editing](../screens/edit-entry/04-editing.png)
5. **Saved**: Save commits one change, closes the panel, keeps the block selected. ![Saved](../screens/edit-entry/05-saved.png)
6. **Delete confirm**: Delete asks for confirmation inside the panel (no browser `confirm`), then removes the Entry and leaves a gap. ![Delete](../screens/edit-entry/06-delete-confirm.png)
7. **Cancelled**: Escape or Cancel discards unsaved edits. ![Cancelled](../screens/edit-entry/07-cancelled.png)
8. **Validation feedback**: hard rule failures (e.g. primary and secondary Activity equal) block progress at submission; soft rules (e.g. minimum sleep) warn and allow it. ![Validation](../screens/edit-entry/08-validation.png)

Multiple-choice Dimensions: overlapping Entries are drawn side by side within the row or column; each is selectable.

## Baseline behaviour without JavaScript

The Respondent changes the control on the relevant card(s) and resubmits the form; clearing the control removes the Entry. There is no inline validation; the server-side check on submission reports problems.

## Enhanced behaviour with JavaScript

- One panel for the whole app ([ADR 0005](../../adr/0005-one-details-panel-in-every-layout.md)); per-Dimension drafts are kept by the panel coordinator so switching Dimension does not lose unsaved edits.
- Activity picker: combobox with search plus a category grid; multiple-choice Dimensions allow several selections.
- Opening another Entry while the panel has unsaved edits asks to save or discard.
- Every change sets Diary status back to in-progress.

## Accessibility

- Each Entry block is a button-like element with an accessible name: "Eating, 12:30 to 13:00, Primary activity".
- Selected state exposed via `aria-pressed` or `aria-current`; the panel is a labelled `region` (or `dialog` when modal on narrow screens).
- Focus moves into the panel on open (first field), returns to the Entry block on close; after Delete, focus moves to the gap slot where the Entry was.
- Validation messages are associated with fields (`aria-describedby`) and announced politely. When the entry is not complete, Save is `aria-disabled` (still focusable) and a visible hint says what is missing, tied to it by `aria-describedby`; pressing it takes focus to what needs doing.
- Escape closes the panel; Tab order: block, panel fields, Save, Cancel, Delete.

## Acceptance criteria

- [ ] Click, tap, Enter or Space on an Entry opens it in the panel.
- [ ] Activity, start, end and duration can be changed and are kept consistent with each other.
- [ ] Invalid values are explained next to the field and Save stays disabled.
- [ ] Save writes the change as one undoable step; Escape/Cancel discards.
- [ ] Delete is confirmed in-page and removes only that Entry.
- [ ] Switching Dimension or Entry never silently drops unsaved edits.
- [ ] Overlapping multiple-choice Entries are individually selectable.
- [ ] Without JavaScript the same changes are possible through the card controls.
- [ ] Panel focus management and announcements work with keyboard and screen reader.
