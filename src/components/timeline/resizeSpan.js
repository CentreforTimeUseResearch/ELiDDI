import { MINUTES_PER_DAY, MIN_ENTRY_DURATION_MINS } from './timelineConstants';

// Where an Entry's edge ends up when it is resized
// (docs/design/flows/move-resize.md). The one place these rules live: the
// pointer's handle drags and the keyboard's grab mode both ask it, so they
// cannot disagree. Pure: no DOM.
//
// One edge moves ('start' or 'end'); the other stays. The Entry stays at least
// 10 minutes long and inside the day, and on the current day ends no later
// than "now".
//
// On a single-choice Dimension, an Entry that shares the edge (it ends where
// this one starts, or starts where this one ends) gives way: its facing
// boundary moves with the edge, so the Timeline stays contiguous. It lengthens
// when the edge is moved away from it and shortens when moved into it, never
// below 10 minutes, and is never deleted: the edge stops there instead. An
// edge with a gap beside it moves only itself, and is stopped by the next
// Entry beyond the gap. A multiple-choice Dimension tolerates overlapping
// Entries, so no other Entry matters.
//
// requestedOffsetMins is where the edge is asked to go (any number, including
// +/-Infinity to ask for the limit). `entry` and `entries` are as they stand
// before the resize.
// -> { startOffsetMins, endOffsetMins, atLimit, neighbours }: the Entry's new
// span; whether a limit held the edge short of where it was asked to go; and
// the Entry that gave way, if any, at its new span, as [{ id, startOffsetMins,
// endOffsetMins }]
export function computeResize({
  entry,
  entries,
  edge,
  requestedOffsetMins,
  singleChoice,
  nowLimitMins,
}) {
  const others = singleChoice ? entries.filter((other) => other.id !== entry.id) : [];
  let adjacent;
  let min;
  let max;
  if (edge === 'start') {
    adjacent = others.find((other) => other.endOffsetMins === entry.startOffsetMins);
    const previousEnd = others
      .filter((other) => other.endOffsetMins <= entry.startOffsetMins)
      .reduce((latest, other) => Math.max(latest, other.endOffsetMins), 0);
    min = adjacent ? adjacent.startOffsetMins + MIN_ENTRY_DURATION_MINS : previousEnd;
    max = Math.min(entry.endOffsetMins - MIN_ENTRY_DURATION_MINS, nowLimitMins);
  } else {
    adjacent = others.find((other) => other.startOffsetMins === entry.endOffsetMins);
    const nextStart = others
      .filter((other) => other.startOffsetMins >= entry.endOffsetMins)
      .reduce((earliest, other) => Math.min(earliest, other.startOffsetMins), MINUTES_PER_DAY);
    min = entry.startOffsetMins + MIN_ENTRY_DURATION_MINS;
    const wall = adjacent ? adjacent.endOffsetMins - MIN_ENTRY_DURATION_MINS : nextStart;
    max = Math.min(wall, MINUTES_PER_DAY, nowLimitMins);
  }
  max = Math.max(max, min); // never let max fall below min if there is no room left
  const offset = Math.min(Math.max(requestedOffsetMins, min), max);

  const startOffsetMins = edge === 'start' ? offset : entry.startOffsetMins;
  const endOffsetMins = edge === 'end' ? offset : entry.endOffsetMins;
  const neighbours = adjacent
    ? [
        edge === 'start'
          ? { id: adjacent.id, startOffsetMins: adjacent.startOffsetMins, endOffsetMins: offset }
          : { id: adjacent.id, startOffsetMins: offset, endOffsetMins: adjacent.endOffsetMins },
      ]
    : [];
  return { startOffsetMins, endOffsetMins, atLimit: offset !== requestedOffsetMins, neighbours };
}
