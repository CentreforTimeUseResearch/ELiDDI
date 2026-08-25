// Entries store times as offsets in minutes from config/activities.json's
// general.day_boundary (e.g. "04:00"), not from midnight - see CONTEXT.md.
export function getDayBoundaryInMinutes() {
  const [hours, minutes] = GLOBALS.DATA.day_boundary.split(':').map(Number);
  return hours * 60 + minutes;
}

// converts an entry's startOffsetMins/endOffsetMins back into a clock time
// for display (e.g. in error messages) - mirrors TimePickerPanel's own
// minutes -> HH:MM formatting, kept here so it doesn't need a component instance
export function formatOffsetAsClockTime(offsetMins) {
  let totalMinutes = offsetMins + getDayBoundaryInMinutes();
  if (totalMinutes >= 24 * 60) {
    totalMinutes -= 24 * 60;
  }
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mins = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${mins}`;
}

// minutes elapsed since day_boundary, wrapping across midnight - inverse of
// formatOffsetAsClockTime's offset -> clock-time math. e.g. day_boundary=04:00,
// wall-clock 02:00 -> 1320 (22:00 into the diary day that started yesterday)
export function getCurrentOffsetMins() {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const MINUTES_PER_DAY = 24 * 60;
  return (nowMinutes - getDayBoundaryInMinutes() + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

// the single seam deciding "what date counts as the diary day" on the very
// first-ever load (currentDate is persisted after that, see appStore.js) -
// a deployment restricted to a fixed past period only needs to change what
// this returns, nothing else needs to know. Formats from local date parts
// rather than toISOString(), which converts to UTC and can shift the date
// near midnight in non-UTC timezones.
export function getCurrentDiaryDateKey() {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const diaryDate = new Date(now);
  if (nowMinutes < getDayBoundaryInMinutes()) {
    diaryDate.setDate(diaryDate.getDate() - 1);
  }
  const year = diaryDate.getFullYear();
  const month = String(diaryDate.getMonth() + 1).padStart(2, '0');
  const day = String(diaryDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// formats a diary date key ("YYYY-MM-DD") for display as "DD/MM/YYYY" - a
// plain string reformat rather than parsing through new Date(dateKey),
// which reads the key as UTC midnight and can shift the displayed date by
// a day in timezones behind UTC
export function formatDateKeyAsDDMMYYYY(dateKey) {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

// the latest editable clock-time-of-day for a Start/End time field, in
// TimePickerPanel's own "minutes since midnight, extended past 1440 for
// times after midnight but before the day boundary" format - or undefined
// if diaryDateKey isn't the actual current diary day, since only "today"
// has a meaningful "future" to restrict (a past diary day's whole span has
// already happened; a future one is blocked from selection entirely by
// the date picker).
export function getMaxEditableTimeInMinutes(diaryDateKey, dayBoundaryInMinutes) {
  if (diaryDateKey !== getCurrentDiaryDateKey()) {
    return undefined;
  }
  return dayBoundaryInMinutes + getCurrentOffsetMins();
}
