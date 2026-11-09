import { MINUTES_PER_DAY, MIN_ENTRY_DURATION_MINS } from './timelineConstants';

// Where an Entry ends up when it is dragged by its body
// (docs/design/flows/move-resize.md): the same duration, somewhere else.
//
// On a single-choice Dimension the Entries next to it give way. Sliding over
// the Entry ahead (or behind) trims that Entry on its facing side, down to
// its own minimum duration; past that the move stops. Entries are never
// swapped, hidden or deleted, so only the nearest one each way ever matters,
// and the space the Entry leaves behind is not filled by its neighbour. A
// multiple-choice Dimension tolerates overlapping Entries, so nothing else
// moves. Either way the Entry stays inside the day and, on the current day,
// ends no later than "now".
//
// requestedStart is where the pointer asks the start to be (a multiple of 10).
// -> { startOffsetMins, endOffsetMins, atLimit, neighbours }: atLimit is
// whether a limit held it short of requestedStart; neighbours are the
// nearest Entry behind and ahead (single-choice only) at the spans they have
// for this position, trimmed or not, as { id, startOffsetMins, endOffsetMins }
export function computeMove({ entry, entries, requestedStart, singleChoice, nowLimitMins }) {
  const duration = entry.endOffsetMins - entry.startOffsetMins;
  let lowestStart = 0;
  let highestStart = Math.min(MINUTES_PER_DAY, nowLimitMins) - duration;
  let behind;
  let ahead;
  if (singleChoice) {
    const others = entries.filter((other) => other.id !== entry.id);
    behind = others
      .filter((other) => other.endOffsetMins <= entry.startOffsetMins)
      .reduce(
        (nearest, other) =>
          !nearest || other.endOffsetMins > nearest.endOffsetMins ? other : nearest,
        undefined
      );
    ahead = others
      .filter((other) => other.startOffsetMins >= entry.endOffsetMins)
      .reduce(
        (nearest, other) =>
          !nearest || other.startOffsetMins < nearest.startOffsetMins ? other : nearest,
        undefined
      );
    if (behind) {
      lowestStart = Math.max(lowestStart, behind.startOffsetMins + MIN_ENTRY_DURATION_MINS);
    }
    if (ahead) {
      highestStart = Math.min(
        highestStart,
        ahead.endOffsetMins - MIN_ENTRY_DURATION_MINS - duration
      );
    }
  }
  // staying put is always allowed, even if it is already past "now"
  lowestStart = Math.min(lowestStart, entry.startOffsetMins);
  highestStart = Math.max(highestStart, entry.startOffsetMins);

  const startOffsetMins = Math.min(Math.max(requestedStart, lowestStart), highestStart);
  const endOffsetMins = startOffsetMins + duration;

  const neighbours = [];
  if (behind) {
    neighbours.push({
      id: behind.id,
      startOffsetMins: behind.startOffsetMins,
      endOffsetMins: Math.min(behind.endOffsetMins, startOffsetMins),
    });
  }
  if (ahead) {
    neighbours.push({
      id: ahead.id,
      startOffsetMins: Math.max(ahead.startOffsetMins, endOffsetMins),
      endOffsetMins: ahead.endOffsetMins,
    });
  }
  return {
    startOffsetMins,
    endOffsetMins,
    atLimit: startOffsetMins !== requestedStart,
    neighbours,
  };
}
