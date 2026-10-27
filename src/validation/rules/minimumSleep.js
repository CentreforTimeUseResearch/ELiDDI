import {
  MINIMUM_SLEEP_MINS,
  PRIMARY_DIMENSION_INDEX,
  SLEEP_CODE,
  entryHasCode,
} from '../activityCodes';

// the Primary activity Entries coded as sleeping add up to at least four
// hours. Sleep recorded as a Secondary activity does not count.
export const minimumSleep = {
  id: 'minimum-sleep',
  title: 'At least 4 hours of sleep',
  check({ diary, config }) {
    const entries = diary?.timelines?.[PRIMARY_DIMENSION_INDEX] ?? [];
    const sleepMins = entries
      .filter((entry) => entryHasCode(entry, PRIMARY_DIMENSION_INDEX, config, SLEEP_CODE))
      .reduce((total, entry) => total + (entry.endOffsetMins - entry.startOffsetMins), 0);
    if (sleepMins >= MINIMUM_SLEEP_MINS) {
      return { passed: true };
    }
    return {
      passed: false,
      message: `${formatDuration(sleepMins)} of sleep recorded (less than ${formatDuration(MINIMUM_SLEEP_MINS)}).`,
    };
  },
};

function formatDuration(mins) {
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
