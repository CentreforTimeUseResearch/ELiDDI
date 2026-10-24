import { findOverlappingEntry, findNextEntry } from '../../utils/entries';
import { formatOffsetAsClockTime } from '../../utils/time';
import { ADD_ENTRY, UPDATE_ENTRY, DELETE_ENTRY } from '../../store/actionTypes';

// What a Timeline can do to its own Entries in the store, and the rules
// that apply - id allocation, overlap validation - with no DOM. Shared by
// Timeline and HorizontalTimeline through BaseTimeline (see
// docs/adr/0003-one-timeline-base-for-both-layouts.md).
//
// Which Entry is selected is the caller's concern: methods that need to
// skip "the Entry being edited" take its id.
export class EntryCommands {
  constructor({ store, getDimensionIndex, getCurrentDate, getEntries }) {
    this.store = store;
    this.getDimensionIndex = getDimensionIndex;
    this.getCurrentDate = getCurrentDate;
    this.getEntries = getEntries;
  }

  get isSingleChoiceDimension() {
    return GLOBALS.DATA.timeline[this.getDimensionIndex()].mode !== 'multiple-choice';
  }

  // one past the highest id on this Timeline, not the count - ids of
  // deleted Entries aren't reused while a higher one remains
  nextId() {
    return this.getEntries().reduce((maxId, entry) => Math.max(maxId, entry.id), -1) + 1;
  }

  findNextEntryAfter(afterOffsetMins, ignoreId) {
    return findNextEntry(this.getEntries(), afterOffsetMins, ignoreId);
  }

  // the Entry `entry` would overlap, or undefined. Only a single-choice
  // Dimension forbids overlaps.
  findConflict(entry, ignoreId) {
    if (!this.isSingleChoiceDimension) {
      return undefined;
    }
    return findOverlappingEntry(this.getEntries(), entry, ignoreId);
  }

  // -> the new Entry's id, or undefined if nothing was added
  create(entry) {
    const dimensionIndex = this.validDimensionIndex();
    if (dimensionIndex === undefined) {
      return undefined;
    }
    const id = this.nextId();
    this.store.dispatch({
      type: ADD_ENTRY,
      payload: { dimensionIndex, date: this.getCurrentDate(), ...entry, id },
    });
    return id;
  }

  update(id, entry) {
    const dimensionIndex = this.validDimensionIndex();
    if (dimensionIndex === undefined) {
      return;
    }
    this.store.dispatch({
      type: UPDATE_ENTRY,
      payload: { id, dimensionIndex, date: this.getCurrentDate(), ...entry },
    });
  }

  // -> whether an Entry was removed; an id that's already gone (e.g. a
  // stray double-click) is a no-op
  remove(id) {
    if (!this.getEntries().some((entry) => entry.id === id)) {
      return false;
    }
    this.store.dispatch({
      type: DELETE_ENTRY,
      payload: { dimensionIndex: this.getDimensionIndex(), date: this.getCurrentDate(), id },
    });
    return true;
  }

  validDimensionIndex() {
    const dimensionIndex = this.getDimensionIndex();
    if (!Number.isInteger(dimensionIndex)) {
      console.error('Problem with identifying dimension index', dimensionIndex);
      return undefined;
    }
    return dimensionIndex;
  }
}

export function formatOverlapMessage(conflict) {
  const start = formatOffsetAsClockTime(conflict.startOffsetMins);
  const end = formatOffsetAsClockTime(conflict.endOffsetMins);
  return `This overlaps with your existing "${conflict.activity}" entry (${start}–${end}). Adjust the time, or edit/delete that entry first.`;
}
