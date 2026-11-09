# Flow: Navigate between days and views

## Trigger

The Respondent wants to see or complete a different Diary day, switch Dimension, or change the zoom of the time axis.

## States

1. **Current day**: header shows the date, Diary status and day controls: Previous day, Next day, Today, date button. ![Current](../screens/navigate/01-current-day.png)
2. **Previous / next day**: the arrows switch `currentDate` by one Diary day; the Timeline is replaced and scrolled to the start of the day (or to "now" for today). ![Step](../screens/navigate/02-step-day.png)
3. **Date picker**: the date button opens the date dialog; choosing a date switches to it. Future dates are disabled. ![Picker](../screens/navigate/03-date-picker.png)
4. **Today**: returns to the current Diary day and scrolls to "now". Disabled when already there. ![Today](../screens/navigate/04-today.png)
5. **Future boundary**: Next day is disabled on today with an explanation ("You can't fill in days that haven't happened"). ![Future](../screens/navigate/05-future-boundary.png)
6. **Switch Dimension**: narrow screens swipe between Timelines or use the Dimension picker; desktop selects the row label. The active Dimension is indicated. ![Dimension](../screens/navigate/06-switch-dimension.png)
7. **Zoom (desktop)**: zoom buttons change how much of the day the axis shows; scroll keeps the visible centre. ![Zoom](../screens/navigate/07-zoom.png)

A Diary day runs from the 04:00 boundary ([ADR 0001](../../adr/0001-day-boundary-not-midnight.md)); "today" before 04:00 is still the previous Diary day.

## Baseline behaviour without JavaScript

The page is a single form for one day. Chunk anchors (8 blocks of 3 hours) and per-card skip links (10 minutes, 1 hour) move within the day. Choosing a different day is done by the study's own link or deployment, not by the form.

## Enhanced behaviour with JavaScript

- Store: `SWITCH_DATE` and `SWITCH_DIMENSION`. Diaries are kept per date, each with a status, so moving away never discards entries.
- Unsaved panel edits prompt to save or discard before the day changes.
- Day buttons move one day per activation (no press-and-hold repeat), to avoid overshooting.
- Day state is shown on the date control (not started, in progress, complete).
- Swiping horizontally between days is **not** offered on narrow screens, because horizontal swipe is used to switch Dimension.
- Selected Dimension and zoom are kept across day changes.

## Accessibility

- Day controls are real buttons with names ("Previous day, Saturday 7 November"); disabled states have a text reason.
- Changing day moves focus to the day heading and announces "Showing Sunday 8 November, 3 of 6 timelines started" through a live region.
- The date dialog is a native `<dialog>` with Escape to close and focus return to the date button.
- Dimension tabs use `role="tablist"` / `tab` with arrow-key movement; the active tab has `aria-selected`.
- Zoom buttons announce the new level.

## Acceptance criteria

- [ ] Previous, Next, Today and the date picker all switch Diary day and keep entered data.
- [ ] Future days cannot be reached by any control.
- [ ] Today respects the 04:00 day boundary.
- [ ] Unsaved edits are never lost silently by navigating.
- [ ] Dimension switching works by swipe, picker and keyboard on narrow screens, and by row label on desktop.
- [ ] Zoom keeps the visible centre of the axis.
- [ ] Focus and announcements follow every navigation change.
- [ ] Without JavaScript, chunk anchors and skip links move through the whole day.
