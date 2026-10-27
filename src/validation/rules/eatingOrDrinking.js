import {
  EATING_OR_DRINKING_CODE,
  PRIMARY_DIMENSION_INDEX,
  SECONDARY_DIMENSION_INDEX,
  entryHasCode,
} from '../activityCodes';

// at least one Primary or Secondary activity Entry is eating or drinking
export const eatingOrDrinking = {
  id: 'eating-or-drinking',
  title: 'Eating or drinking recorded',
  check({ diary, config }) {
    const found = [PRIMARY_DIMENSION_INDEX, SECONDARY_DIMENSION_INDEX].some((dimensionIndex) =>
      (diary?.timelines?.[dimensionIndex] ?? []).some((entry) =>
        entryHasCode(entry, dimensionIndex, config, EATING_OR_DRINKING_CODE)
      )
    );
    return found ? { passed: true } : { passed: false, message: 'No eating or drinking recorded.' };
  },
};
