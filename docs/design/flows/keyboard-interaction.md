# Flow: Keyboard interaction

## Trigger

The Respondent uses only the keyboard (or a switch/screen reader that emulates it) to create, edit, move, resize and navigate. Applies to every flow; this file defines the shared model.

## States

1. **Focus enters a Timeline**: one tab stop for the Timeline, focus on the nearest slot or Entry. ![Enter](../screens/keyboard-interaction/01-enter-timeline.png)
2. **Roving focus**: arrow keys move focus between slots and Entries along the time axis. ![Roving](../screens/keyboard-interaction/02-roving-focus.png)
3. **Entry focused**: Entry shows a focus ring; its name is read out. ![Entry](../screens/keyboard-interaction/03-entry-focused.png)
4. **Grab mode**: Space on an Entry "picks it up"; arrows move it by 10 minutes. ![Grab](../screens/keyboard-interaction/04-grab-mode.png)
5. **Resize mode**: Shift+arrows (or Tab to a handle, then arrows) change one edge by 10 minutes. ![Resize](../screens/keyboard-interaction/05-resize-mode.png)
6. **Commit / cancel**: Enter or Space commits, Escape reverts. ![Commit](../screens/keyboard-interaction/06-commit-cancel.png)
7. **Panel**: Enter on an Entry or slot opens the details panel; Escape returns focus. ![Panel](../screens/keyboard-interaction/07-panel.png)

## Key map

Along the time axis (Up/Down on vertical Timelines, Left/Right on horizontal; the other pair switches Dimension where relevant):

| Key                | On slot                           | On Entry                     | In grab / resize mode            |
| ------------------ | --------------------------------- | ---------------------------- | -------------------------------- |
| Arrow along time   | Previous / next slot              | Previous / next Entry or gap | Move / resize by 10 min          |
| Home / End         | Start / end of day                | First / last Entry           | Jump to limit                    |
| PageUp / PageDown  | -/+ 1 hour                        | -/+ 1 hour                   | -/+ 1 hour                       |
| Enter              | Create default block, open panel  | Open panel                   | Commit                           |
| Space              | Start create (extend with arrows) | Enter grab mode              | Commit                           |
| Shift + arrow      | Extend creation                   | (none: grab it first)        | Resize end edge (start with Alt) |
| Escape             | Cancel                            | Close selection              | Revert                           |
| Delete / Backspace |                                   | Ask to delete                |                                  |
| `[` / `]`          | Previous / next Dimension         | same                         |                                  |
| `,` / `.`          | Previous / next day               | same                         |                                  |
| `t`                | Today                             | same                         |                                  |

No key is single-character-only without a modifier unless it can be turned off or remapped (WCAG 2.1.4); the letter and punctuation shortcuts above apply only while a Timeline has focus (its slots and Entries): never in a text field, the activity list or the details panel, and not while an Entry is grabbed.

- `[` / `]` go from the Timeline that has focus (wrapping round), close the details panel as choosing a Dimension does, and move focus to the new Dimension's Timeline.
- `,` / `.` / `t` do exactly what Previous day, Next day and Today do (including never reaching a day that has not begun, and following the 04:00 boundary), and leave focus on the Timeline, at the same time of day.
- They are not available with Ctrl, Alt or Meta held, and not as Shift+`t`. On a keyboard layout where `[` or `]` needs AltGr, they are not available either; the buttons and the Dimension tabs always are.
- All of them, and the rest of the keyboard help, are listed in the nav menu's "Keyboard shortcuts" dialog.

## Baseline behaviour without JavaScript

Native form controls and links are fully keyboard operable: Tab through cards, arrow keys in `<select>`, Space to toggle checkboxes, skip links for chunks and slots. Nothing custom is required.

## Enhanced behaviour with JavaScript

- Timeline uses roving `tabindex`; one Tab stop per Timeline, so a screen has at most one stop per Dimension.
- Limits and snapping match pointer gestures exactly (same rules as [move-resize](move-resize.md) and [create-entry](create-entry.md)): one pure implementation of each is used by both.
- **Grab mode**: Space on an Entry picks it up. In it, an arrow along the time axis moves the Entry 10 minutes; Shift+arrow moves its end edge and Alt+Shift+arrow its start edge; PageUp/PageDown use an hour instead of 10 minutes (with the same modifiers); Home/End go to the limit; Enter or Space confirms; Escape cancels. Tab, a click, or the Entry being changed elsewhere also cancels. Resizing is only in grab mode, so a stray Shift+arrow never changes an Entry.
- Within a run of one kind of key, each step is worked out from where the run began, so moving on and back restores any neighbour that was trimmed. Changing kind (say, from a move to a resize) starts a new run from what the last one left.
- Nothing is stored until it is confirmed; Escape discards every change, however many kinds were made. Confirming with nothing changed stores nothing and says "No change".
- The message (mode, keys, each step, limits, result) is **one visible status bar** at the bottom of the window that is also a polite live region, so it is read once and seen once. After a confirm or cancel it stays a few seconds.
- Focus never gets lost when blocks re-render: the Entry id (or slot time) is restored after render.
- Visible focus indicator at least 3:1 contrast and not hidden by overlapping blocks.

## Accessibility

- Timeline container: `role="application"` is avoided; use `role="group"` labelled "Primary activity timeline" containing buttons for slots and Entries (`role="grid"` is only used for the activity picker grid).
- A polite `aria-live` region reports each step in modes: "Grabbed Eating, 12:30 to 13:00. Up and Down arrow keys move it. ... Enter to confirm, Escape to cancel."; "Now 12:40 to 13:10."; the Entries that gave way ("The next entry now starts at 13:10."); and any limit with its reason ("Limit reached: the neighbouring entry can't be shorter than 10 minutes.").
- Hint text for the mode is visible on screen, not only announced.
- Panel: focus moves in on open, trapped only when it is modal (narrow screens); Escape closes and focus returns to the invoking element.
- Target WCAG 2.2 AA: 2.1.1 Keyboard, 2.1.4 Character Key Shortcuts, 2.4.7 Focus Visible, 2.4.11 Focus Not Obscured, 2.5.7 Dragging Movements (every drag has a non-drag path), 2.5.8 Target Size.

## Acceptance criteria

- [ ] Every action in the other four flows can be done with the keyboard alone.
- [ ] Each Timeline is a single Tab stop with arrow-key movement inside it.
- [ ] Grab and resize modes move by 10 minutes, obey the same limits as dragging, and can be cancelled with Escape.
- [ ] Mode, current times and limits are announced and shown as text.
- [ ] Focus is visible, never lost on re-render, and returns correctly after the panel closes.
- [ ] Character shortcuts only apply while a Timeline is focused.
- [ ] A screen reader user can create, edit, move, resize and delete an Entry end to end.
- [ ] Without JavaScript the form works with native keyboard behaviour only.
