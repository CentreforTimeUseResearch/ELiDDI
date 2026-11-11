import {
  MINIMUM_SLEEP_MINS,
  PRIMARY_DIMENSION_INDEX,
  SLEEP_CODE,
  entryHasCode,
} from '../activityCodes';
import { t } from '../../i18n/i18n';

// the Primary activity Entries coded as sleeping add up to at least four
// hours. Sleep recorded as a Secondary activity does not count. `title` is a
// getter so the words are looked up when read (ADR 0008).
export const minimumSleep = {
  id: 'minimum-sleep',
  get title() {
    return t('validation.sleep.title', { hours: MINIMUM_SLEEP_MINS / 60 });
  },
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
      message: t('validation.sleep.message', {
        recorded: formatDuration(sleepMins),
        minimum: formatDuration(MINIMUM_SLEEP_MINS),
      }),
    };
  },
};

// "30m", "4h", "1h 30m" - the unit letters are the catalogue's
function formatDuration(mins) {
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (hours === 0) return t('validation.duration.minutes', { minutes: rest });
  return rest === 0
    ? t('validation.duration.hours', { hours })
    : t('validation.duration.hoursMinutes', { hours, minutes: rest });
}
