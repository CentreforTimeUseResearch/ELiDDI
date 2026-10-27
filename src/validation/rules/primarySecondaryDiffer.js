import { SLOT_COUNT, entrySlots, slotClockTime } from '../slots';

const PRIMARY_DIMENSION_INDEX = 0;
const SECONDARY_DIMENSION_INDEX = 1;

// the same Activity must not be recorded as both the Primary and the
// Secondary activity in the same time slot. A slot with nothing recorded on
// one of the two never clashes - missing time is the no-gaps rule's concern.
export const primarySecondaryDiffer = {
  id: 'primary-secondary-differ',
  title: 'Primary and Secondary activity differ',
  check({ diary, config }) {
    const primary = activitiesBySlot(diary?.timelines?.[PRIMARY_DIMENSION_INDEX]);
    const secondary = activitiesBySlot(diary?.timelines?.[SECONDARY_DIMENSION_INDEX]);
    const clashAt = (slot, activity) =>
      primary[slot].has(activity) && secondary[slot].has(activity);

    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const activity = [...primary[slot]].find((name) => secondary[slot].has(name));
      if (activity === undefined) continue;

      // the run of consecutive slots this Activity clashes in
      let end = slot + 1;
      while (end < SLOT_COUNT && clashAt(end, activity)) end++;
      return {
        passed: false,
        message: `"${activity}" is recorded as both Primary and Secondary activity from ${slotClockTime(slot, config)} to ${slotClockTime(end, config)}.`,
      };
    }
    return { passed: true };
  },
};

// -> for each slot, the set of Activities recorded in it
function activitiesBySlot(entries = []) {
  const bySlot = Array.from({ length: SLOT_COUNT }, () => new Set());
  for (const entry of entries) {
    // a single-choice Dimension stores one name; tolerate a list too
    const activities = [].concat(entry.activity).filter(Boolean);
    for (const slot of entrySlots(entry)) {
      activities.forEach((activity) => bySlot[slot].add(activity));
    }
  }
  return bySlot;
}
