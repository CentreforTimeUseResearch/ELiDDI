import {
  EATING_OR_DRINKING_CODE,
  PRIMARY_DIMENSION_INDEX,
  SECONDARY_DIMENSION_INDEX,
  entryHasCode,
} from '../activityCodes';
import { t } from '../../i18n/i18n';

// at least one Primary or Secondary activity Entry is eating or drinking.
// `title` is a getter so the words are looked up when read, not when this
// module is evaluated (ADR 0008)
export const eatingOrDrinking = {
  id: 'eating-or-drinking',
  get title() {
    return t('validation.eating.title');
  },
  check({ diary, config }) {
    const found = [PRIMARY_DIMENSION_INDEX, SECONDARY_DIMENSION_INDEX].some((dimensionIndex) =>
      (diary?.timelines?.[dimensionIndex] ?? []).some((entry) =>
        entryHasCode(entry, dimensionIndex, config, EATING_OR_DRINKING_CODE)
      )
    );
    return found ? { passed: true } : { passed: false, message: t('validation.eating.message') };
  },
};
