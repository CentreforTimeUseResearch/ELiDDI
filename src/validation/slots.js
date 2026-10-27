import { MINUTES_PER_DAY, MIN_ENTRY_DURATION_MINS } from '../components/timeline/timelineConstants';
import { formatOffsetAsClockTime, parseDayBoundary } from '../utils/time';

// The validation rules look at the day one ten-minute slot at a time (a
// Diary's time slots, see the README). Slot 0 starts at the Day boundary.

export const SLOT_COUNT = MINUTES_PER_DAY / MIN_ENTRY_DURATION_MINS; // 144

// the slots an Entry uses: every slot it overlaps, so one that is shorter or
// off the ten-minute grid still counts the slots it touches. Entries are
// half-open spans, so back-to-back Entries share no slot.
export function entrySlots({ startOffsetMins, endOffsetMins }) {
  const first = Math.max(0, Math.floor(startOffsetMins / MIN_ENTRY_DURATION_MINS));
  const end = Math.min(SLOT_COUNT, Math.ceil(endOffsetMins / MIN_ENTRY_DURATION_MINS));
  const slots = [];
  for (let slot = first; slot < end; slot++) {
    slots.push(slot);
  }
  return slots;
}

// the clock time a slot starts at (slot SLOT_COUNT is the end of the day),
// read against the study's day boundary
export function slotClockTime(slot, config) {
  return formatOffsetAsClockTime(
    slot * MIN_ENTRY_DURATION_MINS,
    parseDayBoundary(config.day_boundary)
  );
}
