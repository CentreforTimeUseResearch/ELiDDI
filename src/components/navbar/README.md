# Navbar (`el-nav-bar`)

[← Back to root README](../../../README.md)

---

## What it does

The top navigation bar: a hamburger menu (Instructions / Reset), the [Timeline Picker](../timelinePicker/README.md) for switching Dimension, the day controls (Previous day, the date button, Next day, Today), and the [Contextual Help](../contextualHelp/README.md) button.

## Custom element

`<el-nav-bar>` — no attributes or props.

## Store interaction

- Subscribes to the store to keep the date button (the day, and its status) and the day buttons in sync with `currentDate` and the Diary.
- With server accounts on (`general.server_accounts`), the menu also has a "Log out (switch person)" item, which first sends anything the server lacks and then ends the login on this device and on the server (see [Login](../login/README.md); if the changes cannot be sent, `<el-sync-notice>` asks the Respondent what to do). Without accounts it is not rendered. With accounts on, the right of the nav bar also has `<el-sync-status>`, a polite live region reading "Saved", "Saving…", "Not saved yet - will retry" or "Could not save to the server - your diary is kept on this device" (from `src/sync/syncStatus.js`; see the [sync README](../../sync/README.md)).
- Dispatches `RESET_ONBOARDING` (Instructions menu item), `SHOW_PANEL` with payload `'date'` (date button) and `SHOW_PANEL` with payload `'reset'` (Reset menu item). Reset clears nothing itself: [DynamicTimelineUI](../dynamicTimelineUI/README.md)'s confirm dialog dispatches `CLEAR_DIARY` for the viewed day.

## Day controls

[navigate flow](../../../docs/design/flows/navigate.md). A group named "Change day": **Previous day** `‹`, the **date button** (opens the date dialog, as before), **Next day** `›` and **Today**.

- Each moves one day per press and dispatches `HIDE_PANEL` then `SWITCH_DATE`, exactly as the [date picker](../datePicker/README.md) does. The logic is in [`utils/navigation.js`](../../utils/navigation.js) (`stepDay`, `goToToday`, `dayBefore`), which the Timelines' keyboard shortcuts call too, so a shortcut does the same as its button by construction, so the Dimension and zoom are kept and nothing entered is lost (each date keeps its own Diary).
- They are named for where they go: "Previous day, Saturday 7 November", "Next day, Monday 9 November", "Today, Monday 9 November" (`formatDateKeyAsLongDate`). The dates are worked out from the date parts (`addDaysToDateKey`), never by adding 24 hours, so clock changes cannot repeat or skip a date.
- **No future days.** "Today" is `getCurrentDiaryDateKey()`, so it follows the 04:00 day boundary ([ADR 0001](../../../docs/adr/0001-day-boundary-not-midnight.md)): before 04:00 it is still yesterday's date. Next day is off on today, Today is off when already there. Both are re-checked when pressed, not only when drawn, so a page left open across 04:00 still behaves. A stored day in the future (which no control can reach) steps back to today, never on.
- **Off, but reachable.** They use `aria-disabled`, not `disabled`, so a keyboard user can still focus them and find out why: the reason ("You can't fill in days that haven't happened", "Already showing today") is the button's `title` and a visually hidden description it points at with `aria-describedby`. A disabled Next day is named just "Next day", since its date does not exist yet.
- The date button also shows the day's status under the date: "Not started" (nothing entered), "In progress" or "Complete" (`getDayStatus`). On screens under 630px the words "Selected day:" are visually hidden (kept for screen readers) so the date, "change" and the status fit.
- There is no press-and-hold repeat, and no swipe between days (a horizontal swipe switches Dimension).
- **A day change is announced**, however it happened (a day button, the date picker, anything else that switches the date): "Showing Sunday 8 November, 3 of 6 timelines started", or "..., diary complete" for a submitted day (`getDayAnnouncement`), through the page's polite live region ([`utils/announce.js`](../../utils/announce.js)). It is not announced when the bar is first shown, nor for other changes. Focus is **not** moved: it stays on the button that was pressed so it can be pressed again (stepping back several days would otherwise mean finding it again each time), and the date dialog hands focus back to the date button when it closes ([DialogWidget](../dialogWidget/README.md)).

## Keyboard shortcuts menu item

A "Keyboard shortcuts" item (both copies of the menu) dispatches `SHOW_PANEL` with payload `'shortcuts'`, which [DynamicTimelineUI](../dynamicTimelineUI/README.md) shows as a dialog hosting [`<el-keyboard-help>`](../keyboardHelp/README.md); the drawer closes as it does for Reset. Focus returns to the item when the dialog closes ([DialogWidget](../dialogWidget/README.md)).

## Behaviour notes

- "Work in progress" per its own source comments — the other menu items (View stats, About this study) have no handler wired up yet.

---

[← Back to root README](../../../README.md)
