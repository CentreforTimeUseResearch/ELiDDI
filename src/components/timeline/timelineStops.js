import { MINUTES_PER_DAY, MIN_ENTRY_DURATION_MINS } from './timelineConstants';

// The places keyboard focus can be on a Timeline, in time order: each Entry,
// and each 10-minute slot no Entry covers (a covered slot is its Entry's, not
// a stop of its own). Moving focus along the time axis is moving along this
// list. Pure: no DOM.
//
// A stop is { type: 'entry', id, startOffsetMins, endOffsetMins } or
// { type: 'slot', startOffsetMins, endOffsetMins }.

const STEP_HOUR_MINS = 60;

export function stopKey(stop) {
  return stop.type === 'entry' ? `entry:${stop.id}` : `slot:${stop.startOffsetMins}`;
}

export function buildStops(entries) {
  const stops = entries.map((entry) => ({
    type: 'entry',
    id: entry.id,
    startOffsetMins: entry.startOffsetMins,
    endOffsetMins: entry.endOffsetMins,
  }));
  for (let start = 0; start < MINUTES_PER_DAY; start += MIN_ENTRY_DURATION_MINS) {
    const end = start + MIN_ENTRY_DURATION_MINS;
    const covered = entries.some(
      (entry) => entry.startOffsetMins < end && entry.endOffsetMins > start
    );
    if (!covered) {
      stops.push({ type: 'slot', startOffsetMins: start, endOffsetMins: end });
    }
  }
  return stops.sort(
    (a, b) =>
      a.startOffsetMins - b.startOffsetMins ||
      (a.type === b.type ? 0 : a.type === 'entry' ? -1 : 1) ||
      (a.id ?? 0) - (b.id ?? 0)
  );
}

// the first stop whose span holds this time (so, of overlapping Entries, the
// earliest-starting); a time outside the day gives the first or last stop
export function stopContaining(stops, mins) {
  if (mins < 0) {
    return stops[0];
  }
  return (
    stops.find((stop) => stop.startOffsetMins <= mins && mins < stop.endOffsetMins) ??
    stops[stops.length - 1]
  );
}

function indexOfStop(stops, current) {
  const key = stopKey(current);
  const index = stops.findIndex((stop) => stopKey(stop) === key);
  if (index !== -1) {
    return index;
  }
  // the stop is gone (a slot that has since been covered, a deleted Entry):
  // go by where it was in time
  return stops.indexOf(stopContaining(stops, current.startOffsetMins));
}

// the stop after (direction 1) or before (-1) `current`, staying at either
// end of the day
export function neighbourStop(stops, current, direction) {
  const index = indexOfStop(stops, current) + direction;
  return stops[Math.min(Math.max(index, 0), stops.length - 1)];
}

// the stop an hour on (direction 1) or back (-1) from the start of `current`.
// If that lands inside `current` itself (a long Entry), it steps on to the
// neighbouring stop instead, so the key always goes somewhere
export function hourStop(stops, current, direction) {
  const target = current.startOffsetMins + direction * STEP_HOUR_MINS;
  const found = stopContaining(stops, Math.min(Math.max(target, 0), MINUTES_PER_DAY - 1));
  return stopKey(found) === stopKey(current) ? neighbourStop(stops, current, direction) : found;
}

export function firstStop(stops) {
  return stops[0];
}

export function lastStop(stops) {
  return stops[stops.length - 1];
}
