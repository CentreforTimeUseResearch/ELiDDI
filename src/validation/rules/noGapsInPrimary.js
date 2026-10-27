import { SLOT_COUNT, entrySlots, slotClockTime } from '../slots';

const PRIMARY_DIMENSION_INDEX = 0;

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
    return { passed: false, message: describeGaps(gaps, config) };
  },
};

// -> the runs of unused slots, each [firstSlot, endSlot) in slot numbers
function findGaps(entries) {
  const used = new Array(SLOT_COUNT).fill(false);
  for (const entry of entries) {
    entrySlots(entry).forEach((slot) => (used[slot] = true));
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

function describeGaps(gaps, config) {
  if (gaps.length === 1 && gaps[0][1] - gaps[0][0] === SLOT_COUNT) {
    return 'No Primary activity has been recorded.';
  }
  const [from, to] = gaps[0];
  const more = gaps.length - 1;
  const alsoMissing = more > 0 ? ` (and ${more} more gap${more === 1 ? '' : 's'})` : '';
  return `Primary activity is missing from ${slotClockTime(from, config)} to ${slotClockTime(to, config)}${alsoMissing}.`;
}
