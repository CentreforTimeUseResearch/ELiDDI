import { describe, it, expect } from 'vitest';
import { eliddiReducer } from './eliddiReducer';
import { DIARY_STATUS } from './diaryStatus';
import {
  RESET_STATUS,
  SET_COMPLETE,
  SWITCH_DATE,
  SET_HORIZONTAL_ZOOM,
  ADD_TIMELINE,
  ADD_ENTRY,
  UPDATE_ENTRY,
  DELETE_ENTRY,
} from './actionTypes';

const DATE = '2026-08-21';

describe('eliddiReducer - status', () => {
  it('starts a new Diary in progress', () => {
    const state = eliddiReducer(undefined, {
      type: ADD_TIMELINE,
      payload: { date: DATE, dimensionIndex: 0 },
    });
    expect(state.diaries[DATE].status).toBe(DIARY_STATUS.IN_PROGRESS);
  });

  // regression coverage (#143): SET_COMPLETE used to store the string '100'
  // while every other path stored a number, so status had no single type
  it('marks a Diary complete on SET_COMPLETE, as a number', () => {
    const state = eliddiReducer(undefined, { type: SET_COMPLETE, payload: { date: DATE } });
    expect(state.diaries[DATE].status).toBe(DIARY_STATUS.COMPLETE);
    expect(typeof state.diaries[DATE].status).toBe('number');
  });

  it('returns a Diary to in progress on RESET_STATUS', () => {
    const completedState = eliddiReducer(undefined, {
      type: SET_COMPLETE,
      payload: { date: DATE },
    });
    const resetState = eliddiReducer(completedState, {
      type: RESET_STATUS,
      payload: { date: DATE },
    });
    expect(resetState.diaries[DATE].status).toBe(DIARY_STATUS.IN_PROGRESS);
  });

  // carried over from the old SET_STATUS regression test: an action that
  // targets a Diary but not its status must preserve it, not reset it
  it('preserves a completed status across entry edits to the same Diary', () => {
    const completedState = eliddiReducer(undefined, {
      type: SET_COMPLETE,
      payload: { date: DATE },
    });
    const afterEdit = eliddiReducer(completedState, {
      type: ADD_ENTRY,
      payload: { date: DATE, dimensionIndex: 0, id: 0, startOffsetMins: 0, endOffsetMins: 10 },
    });
    expect(afterEdit.diaries[DATE].status).toBe(DIARY_STATUS.COMPLETE);
  });

  it('tracks status independently per date', () => {
    const otherDate = '2026-08-22';
    const state = eliddiReducer(undefined, { type: SET_COMPLETE, payload: { date: DATE } });

    expect(state.diaries[DATE].status).toBe(DIARY_STATUS.COMPLETE);
    expect(state.diaries[otherDate]).toBeUndefined();
  });
});

describe('eliddiReducer - entries', () => {
  const DIMENSION = 2;

  function entry(id, activity) {
    return { id, activity, startOffsetMins: id * 10, endOffsetMins: id * 10 + 10 };
  }

  // three entries, ids 0..2, on DATE/DIMENSION
  function stateWithEntries() {
    return [entry(0, 'Home'), entry(1, 'Work'), entry(2, 'Shop')].reduce(
      (state, e) =>
        eliddiReducer(state, {
          type: ADD_ENTRY,
          payload: { date: DATE, dimensionIndex: DIMENSION, ...e },
        }),
      undefined
    );
  }

  function timelineOf(state) {
    return state.diaries[DATE].timelines[DIMENSION];
  }

  it('replaces the matching entry by id on UPDATE_ENTRY, keeping its position', () => {
    const state = eliddiReducer(stateWithEntries(), {
      type: UPDATE_ENTRY,
      payload: { date: DATE, dimensionIndex: DIMENSION, ...entry(1, 'Gym') },
    });

    expect(timelineOf(state).map((e) => e.activity)).toEqual(['Home', 'Gym', 'Shop']);
  });

  // regression coverage (#143): UPDATE_ENTRY used to splice at a
  // caller-supplied array index. A missing or -1 index evaluated
  // state.slice(0, -1) + entry + state.slice(0) - dropping the last entry,
  // then re-appending the whole timeline, duplicating every entry
  it.each([
    ['an id that is not in the timeline', { ...entry(9, 'Gym') }],
    ['a stale index of -1 for an unknown id', { ...entry(9, 'Gym'), index: -1 }],
  ])('leaves the timeline unchanged on UPDATE_ENTRY for %s', (_, update) => {
    const before = stateWithEntries();

    const after = eliddiReducer(before, {
      type: UPDATE_ENTRY,
      payload: { date: DATE, dimensionIndex: DIMENSION, ...update },
    });

    expect(timelineOf(after)).toEqual(timelineOf(before));
  });

  it('ignores any index in the UPDATE_ENTRY payload, resolving by id', () => {
    const state = eliddiReducer(stateWithEntries(), {
      type: UPDATE_ENTRY,
      payload: { date: DATE, dimensionIndex: DIMENSION, ...entry(2, 'Gym'), index: 0 },
    });

    expect(timelineOf(state).map((e) => e.activity)).toEqual(['Home', 'Work', 'Gym']);
  });

  it('removes the matching entry by id on DELETE_ENTRY', () => {
    const state = eliddiReducer(stateWithEntries(), {
      type: DELETE_ENTRY,
      payload: { date: DATE, dimensionIndex: DIMENSION, id: 1 },
    });

    expect(timelineOf(state).map((e) => e.id)).toEqual([0, 2]);
  });

  // hardening (#143): the per-Dimension timeline reducer destructured
  // action.payload unconditionally - safe only because its one caller
  // happens to filter out payload-less actions first
  it.each([ADD_ENTRY, UPDATE_ENTRY, DELETE_ENTRY, ADD_TIMELINE, SET_COMPLETE])(
    'does not throw for a %s action with no payload',
    (type) => {
      const before = stateWithEntries();
      expect(() => eliddiReducer(before, { type })).not.toThrow();
      expect(eliddiReducer(before, { type }).diaries).toBe(before.diaries);
    }
  );
});

describe('eliddiReducer - currentDate', () => {
  it('switches the current date on SWITCH_DATE', () => {
    const state = eliddiReducer(undefined, { type: SWITCH_DATE, payload: DATE });
    expect(state.currentDate).toBe(DATE);
  });
});

describe('eliddiReducer - horizontalZoomLevel', () => {
  it('defaults to native scale (1)', () => {
    const state = eliddiReducer(undefined, { type: '@@INIT' });
    expect(state.horizontalZoomLevel).toBe(1);
  });

  it('sets the zoom level on SET_HORIZONTAL_ZOOM', () => {
    const state = eliddiReducer(undefined, { type: SET_HORIZONTAL_ZOOM, payload: 2.5 });
    expect(state.horizontalZoomLevel).toBe(2.5);
  });
});
