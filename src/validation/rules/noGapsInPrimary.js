import { SLOT_COUNT, entrySlots, slotClockTime } from '../slots';
import { t } from '../../i18n/i18n';

const PRIMARY_DIMENSION_INDEX = 0;

// the Primary activity Timeline must cover the whole day: every ten-minute
// slot is used by at least one Entry. The whole day counts, including slots
// that are still in the future today. `title` is a getter so the words are
// looked up when read (ADR 0008).
export const noGapsInPrimary = {
  id: 'no-gaps-in-primary',
  get title() {
    return t('validation.noGaps.title');
  },
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
    return t('validation.noGaps.none');
  }
  const [first, end] = gaps[0];
  const more = gaps.length - 1;
  const times = { from: slotClockTime(first, config), to: slotClockTime(end, config) };
  if (more === 0) {
    return t('validation.noGaps.missing', times);
  }
  // one sentence per number (ADR 0008: explicit keys, no plural engine)
  return t(
    more === 1 ? 'validation.noGaps.missingMore.one' : 'validation.noGaps.missingMore.other',
    {
      ...times,
      more,
    }
  );
}
