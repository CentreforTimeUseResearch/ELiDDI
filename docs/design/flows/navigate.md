# Flow: Navigate between days and views

## Trigger

The Respondent wants to see or complete a different Diary day, switch Dimension, or change the zoom of the time axis.

## States

1. **Current day**: the top bar shows the date with a "change" link, and Previous / Next day arrows from 630px up. Below 630px the arrows are hidden and "change" (the date picker) is the only way to another day. There is no Today button (diaries are usually two days long). ![Current](../screens/navigate/01-current-day.png)
2. **Previous / next day**: the arrows switch `currentDate` by one Diary day; the Timeline is replaced and scrolled to the start of the day (or to "now" for today). ![Step](../screens/navigate/02-step-day.png)
3. **Date picker**: the date button opens the date dialog; choosing a date switches to it. Future dates are disabled. ![Picker](../screens/navigate/03-date-picker.png)
4. **Top bar by width** (issue #274, designs in `docs/design/new/`): below 630px burger, date + "change", Dimension dropdown, help button; 630-1199px adds the Previous / Next arrows; from 1200px the burger gives way to the five menu links (Instructions, Keyboard shortcuts, Reset, View stats, About this study). The burger opens the menu drawer below 1200px. With server accounts on, the sync indicator sits beside the help button from 630px and in the top of the drawer below it; a failed save puts a badge on the burger.
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
- Day state (not started, in progress, complete) is read out with the date control and shown beside each day in the date dialog; it is not drawn in the top bar.
- Swiping horizontally between days is **not** offered on narrow screens, because horizontal swipe is used to switch Dimension.
- Selected Dimension and zoom are kept across day changes.

## Accessibility

- The "change" link is `--color-primary-on-dark` (at least 4.5:1 on the black bar) and underlined. Day controls are real buttons with names ("Previous day, Saturday 7 November"); disabled states have a text reason.
- Changing day announces "Showing Sunday 8 November, 3 of 6 timelines started" (or "..., diary complete") through a polite live region, however the day was changed. **Focus is not moved** by the day buttons: it stays on the one pressed, so Previous or Next can be pressed again without finding them each time. (An earlier version of this flow moved focus to a day heading; with repeated stepping that ejects the keyboard user from the control on every press.) After the date dialog, focus returns to the date button.
- The date dialog is a native `<dialog>` with Escape to close and focus return to the date button.
- Desktop: the Dimension row labels are a vertical `role="tablist"` named "Dimensions"; the current Dimension's `tab` is `aria-selected` and the one Tab stop; Down/Up move and select (wrapping), Home/End go to the ends. Narrow screens: the Dimension picker is a native `<select>` named "Dimension", which already exposes its role and value and the arrow keys; it keeps keyboard focus as the Dimension changes (a tab list would not fit six names on a phone).
- Zoom buttons announce the new level ("Zoom 125%"; at the limits, "the closest view" / "the whole day is showing"), and hand focus to the other button when the one pressed disables itself at a limit.

## Acceptance criteria

- [ ] Previous, Next and the date picker all switch Diary day and keep entered data.
- [ ] Future days cannot be reached by any control.
- [ ] The date picker lists each known day with its status, and respects the 04:00 day boundary.
- [ ] Text in the top bar is at least 16px (dropdown, menu links) or 11px (date, "change"); the small layout works from 360px wide with no second row.
- [ ] Unsaved edits are never lost silently by navigating.
- [ ] Dimension switching works by swipe, picker and keyboard on narrow screens, and by row label on desktop.
- [ ] Zoom keeps the visible centre of the axis.
- [ ] Every day change is announced; focus stays on the button used, and returns to the date button after the date dialog.
- [ ] Without JavaScript, chunk anchors and skip links move through the whole day.
