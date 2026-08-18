// Entries store times as offsets in minutes from config/activities.json's
// general.day_boundary (e.g. "04:00"), not from midnight - see GLOSSARY.MD.
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
  return ((nowMinutes - getDayBoundaryInMinutes()) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}
