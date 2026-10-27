import { findActivityInDimension } from '../utils/activities';

// Codes of the Activities the rules look for, and how much sleep is enough.
// Fixed for now; a later change may let a study set them.
export const SLEEP_CODE = 101;
export const EATING_OR_DRINKING_CODE = 104;
export const MINIMUM_SLEEP_MINS = 4 * 60;

export const PRIMARY_DIMENSION_INDEX = 0;
export const SECONDARY_DIMENSION_INDEX = 1;

// An Entry stores its Activity's display name, not its code, so the code is
// found by looking the name up in the study config. -> undefined for free
// text, for a name the config does not have, or for an Activity with no code.
export function entryActivityCodes(entry, dimensionIndex, config) {
  const dimension = config?.timeline?.[dimensionIndex];
  return [].concat(entry.activity).map((name) => findActivityInDimension(dimension, name)?.code);
}

export function entryHasCode(entry, dimensionIndex, config, code) {
  return entryActivityCodes(entry, dimensionIndex, config).some(
    (entryCode) => String(entryCode) === String(code)
  );
}
