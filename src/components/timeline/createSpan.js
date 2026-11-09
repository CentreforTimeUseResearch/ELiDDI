import { getCurrentOffsetMins, getCurrentDiaryDateKey } from '../../utils/time';
import { MINUTES_PER_DAY, MIN_ENTRY_DURATION_MINS } from './timelineConstants';

// how long the block made by a plain click or tap is (docs/design/flows/create-entry.md)
export const DEFAULT_NEW_ENTRY_MINS = 30;

// the latest offset an Entry may end at: the end of the day, or on the actual
// current Diary day "now" - floored to the grid, like every other offset, so
// the limit never lands on a minute no other time in the app produces
export function getNowLimitOffsetMins(currentDate) {
  return currentDate === getCurrentDiaryDateKey()
    ? Math.floor(getCurrentOffsetMins() / MIN_ENTRY_DURATION_MINS) * MIN_ENTRY_DURATION_MINS
    : MINUTES_PER_DAY;
}

// The span a create gesture makes, from the 10-minute slot it began on
// (anchorMins) to the slot the pointer is now on (currentMins). Leave
// currentMins out for a plain click or tap, which makes a default-length
// block instead. Both are slot-start offsets (multiples of 10).
//
// A single-choice Dimension never overlaps, so the span is clamped to the
// free space around the anchor slot; a multiple-choice one may overlap its
// neighbours. Either way it stays inside the day and no later than "now".
//
// -> { startOffsetMins, endOffsetMins, atLimit }, atLimit being whether a
// limit cut the span short of what was asked for; or null when there is no
// room at all (the anchor slot is covered, or is not yet in the past)
export function clampCreateSpan({
  anchorMins,
  currentMins,
  entries,
  singleChoice,
  nowLimitMins,
  defaultLengthMins = DEFAULT_NEW_ENTRY_MINS,
}) {
  const anchorEndMins = anchorMins + MIN_ENTRY_DURATION_MINS;
  let lower = 0;
  let upper = Math.min(MINUTES_PER_DAY, nowLimitMins);
  if (singleChoice) {
    const covered = entries.some(
      (entry) => entry.startOffsetMins < anchorEndMins && entry.endOffsetMins > anchorMins
    );
    if (covered) {
      return null;
    }
    lower = entries
      .filter((entry) => entry.endOffsetMins <= anchorMins)
      .reduce((max, entry) => Math.max(max, entry.endOffsetMins), lower);
    upper = entries
      .filter((entry) => entry.startOffsetMins >= anchorEndMins)
      .reduce((min, entry) => Math.min(min, entry.startOffsetMins), upper);
  }
  if (anchorMins < lower || anchorEndMins > upper) {
    return null;
  }

  let startOffsetMins = anchorMins;
  let wantedEndMins;
  if (currentMins === undefined) {
    wantedEndMins = anchorMins + defaultLengthMins;
  } else if (currentMins >= anchorMins) {
    wantedEndMins = currentMins + MIN_ENTRY_DURATION_MINS;
  } else {
    startOffsetMins = Math.max(currentMins, lower);
    wantedEndMins = anchorEndMins;
    return {
      startOffsetMins,
      endOffsetMins: wantedEndMins,
      atLimit: startOffsetMins !== currentMins,
    };
  }
  const endOffsetMins = Math.min(wantedEndMins, upper);
  return { startOffsetMins, endOffsetMins, atLimit: endOffsetMins !== wantedEndMins };
}
