# Date Picker (`el-date-picker`)

[← Back to root README](../../../README.md)

---

## What it does

A native `<input type="date">` wrapped as a component, letting the Respondent switch which Diary date they're viewing/editing. It's rendered inside a modal opened from the [Navbar](../navbar/README.md) (via [DynamicTimelineUI](../dynamicTimelineUI/README.md)'s date `<el-dialog>`).

Terminology (Diary, Respondent) follows [CONTEXT.md](../../../CONTEXT.md).

## Custom element

`<el-date-picker>` — no attributes or props; it reads/writes the currently-viewed date directly from the app store.

## Store interaction

- Reads `currentDate` on construction and re-renders whenever it changes elsewhere (e.g. the Respondent picks a date from this same picker, which round-trips through the store).
- On a valid change, dispatches `HIDE_PANEL` (closing whatever panel was open) then `SWITCH_DATE` with the new date key.

## Behaviour notes

- The native picker's `max` attribute is set to today's diary date key to stop the UI offering future dates, but a typed or scripted value can still slip past that — `switchDate` defensively re-checks and rejects any date after today, re-rendering to reset the input if it does.
- Date keys are `YYYY-MM-DD` strings; see `getCurrentDiaryDateKey()` in `src/utils/time.js` for how "today" is computed relative to the Day boundary (a diary day doesn't run midnight-to-midnight — see [ADR-0001](../../../docs/adr/0001-day-boundary-not-midnight.md)).

---

[← Back to root README](../../../README.md)
