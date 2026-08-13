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
