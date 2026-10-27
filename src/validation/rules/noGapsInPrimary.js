import {
  MINUTES_PER_DAY,
  MIN_ENTRY_DURATION_MINS,
} from '../../components/timeline/timelineConstants';
import { formatOffsetAsClockTime, parseDayBoundary } from '../../utils/time';

const PRIMARY_DIMENSION_INDEX = 0;
const SLOT_COUNT = MINUTES_PER_DAY / MIN_ENTRY_DURATION_MINS; // 144

// the Primary activity Timeline must cover the whole day: every ten-minute
// slot is used by at least one Entry. The whole day counts, including slots
// that are still in the future today.
export const noGapsInPrimary = {
  id: 'no-gaps-in-primary',
  title: 'No gaps in Primary activity',
  check({ diary, config }) {
    const entries = diary?.timelines?.[PRIMARY_DIMENSION_INDEX] ?? [];
    const gaps = findGaps(entries);
    if (gaps.length === 0) {
      return { passed: true };
    }
    return { passed: false, message: describeGaps(gaps, parseDayBoundary(config.day_boundary)) };
  },
};

// -> the runs of unused slots, each [firstSlot, endSlot) in slot numbers
function findGaps(entries) {
  const used = new Array(SLOT_COUNT).fill(false);
  for (const { startOffsetMins, endOffsetMins } of entries) {
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const slotStart = slot * MIN_ENTRY_DURATION_MINS;
      // half-open spans overlap - back-to-back Entries leave no gap
      if (startOffsetMins < slotStart + MIN_ENTRY_DURATION_MINS && slotStart < endOffsetMins) {
        used[slot] = true;
      }
    }
  }
  const gaps = [];
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    if (used[slot]) continue;
    const last = gaps[gaps.length - 1];
    if (last && last[1] === slot) {
      last[1] = slot + 1;
    } else {
      gaps.push([slot, slot + 1]);
    }
  }
  return gaps;
}

function describeGaps(gaps, dayBoundaryMins) {
  if (gaps.length === 1 && gaps[0][1] - gaps[0][0] === SLOT_COUNT) {
    return 'No Primary activity has been recorded.';
  }
  const clock = (slot) => formatOffsetAsClockTime(slot * MIN_ENTRY_DURATION_MINS, dayBoundaryMins);
  const [from, to] = gaps[0];
  const more = gaps.length - 1;
  const alsoMissing = more > 0 ? ` (and ${more} more gap${more === 1 ? '' : 's'})` : '';
  return `Primary activity is missing from ${clock(from)} to ${clock(to)}${alsoMissing}.`;
}
