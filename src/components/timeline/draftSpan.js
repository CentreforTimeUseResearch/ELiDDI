import { MINUTES_PER_DAY, MIN_ENTRY_DURATION_MINS } from './timelineConstants';

// The id the provisional block of a new Entry goes by while it is dragged:
// the same drag machinery as a saved Entry's (DragSession, the handles), but
// the block is not in the store. Real ids are never negative.
export const DRAFT_ENTRY_ID = -1;

// Where the provisional block of a new Entry ends up when it is dragged
// (docs/design/flows/create-entry.md, "Adjusting"). Pure: no DOM.
//
// Unlike a saved Entry's resize or move (resizeSpan, moveSpan), nothing is
// stored yet, so no other Entry gives way: on a single-choice Dimension the
// nearest Entries either side are walls the block stops at. A multiple-choice
// Dimension tolerates overlap, so only the day and "now" limit it. The block
// stays at least 10 minutes long.

// the earliest start and latest end the draft may have
function limits({ draft, entries, singleChoice, nowLimitMins }) {
  let lower = 0;
  let upper = Math.min(MINUTES_PER_DAY, nowLimitMins);
  if (singleChoice) {
    lower = entries
      .filter((entry) => entry.endOffsetMins <= draft.startOffsetMins)
      .reduce((latest, entry) => Math.max(latest, entry.endOffsetMins), lower);
    upper = entries
      .filter((entry) => entry.startOffsetMins >= draft.endOffsetMins)
      .reduce((earliest, entry) => Math.min(earliest, entry.startOffsetMins), upper);
  }
  // staying put is always allowed, even if the draft is already past "now"
  return {
    lower: Math.min(lower, draft.startOffsetMins),
    upper: Math.max(upper, draft.endOffsetMins),
  };
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// one edge ('start' or 'end') asked to go to requestedOffsetMins
// -> { startOffsetMins, endOffsetMins, atLimit, neighbours: [] }
export function computeDraftResize({
  draft,
  edge,
  requestedOffsetMins,
  entries,
  singleChoice,
  nowLimitMins,
}) {
  const { lower, upper } = limits({ draft, entries, singleChoice, nowLimitMins });
  const offset =
    edge === 'start'
      ? clamp(requestedOffsetMins, lower, draft.endOffsetMins - MIN_ENTRY_DURATION_MINS)
      : clamp(requestedOffsetMins, draft.startOffsetMins + MIN_ENTRY_DURATION_MINS, upper);
  return {
    startOffsetMins: edge === 'start' ? offset : draft.startOffsetMins,
    endOffsetMins: edge === 'end' ? offset : draft.endOffsetMins,
    atLimit: offset !== requestedOffsetMins,
    neighbours: [],
  };
}

// the whole block asked to start at requestedStart, keeping its length
// -> { startOffsetMins, endOffsetMins, atLimit, neighbours: [] }
export function computeDraftMove({ draft, requestedStart, entries, singleChoice, nowLimitMins }) {
  const duration = draft.endOffsetMins - draft.startOffsetMins;
  const { lower, upper } = limits({ draft, entries, singleChoice, nowLimitMins });
  const startOffsetMins = clamp(requestedStart, lower, upper - duration);
  return {
    startOffsetMins,
    endOffsetMins: startOffsetMins + duration,
    atLimit: startOffsetMins !== requestedStart,
    neighbours: [],
  };
}
