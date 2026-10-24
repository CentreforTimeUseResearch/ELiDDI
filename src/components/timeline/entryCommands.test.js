import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EntryCommands, formatOverlapMessage } from './entryCommands';
import { createStore } from '../../store/store';
import { eliddiReducer } from '../../store/eliddiReducer';
import { ADD_TIMELINE, ADD_ENTRY } from '../../store/actionTypes';

// Entry CRUD and overlap validation, exercised against a real store without
// mounting a Timeline - the behaviour both Timeline and HorizontalTimeline
// share (#139)
const DATE = '2026-08-21';
const LOCATION = 2; // single-choice
const WHO = 3; // multiple-choice

function setup(dimensionIndex = LOCATION, seed = []) {
  const store = createStore(eliddiReducer);
  store.dispatch({ type: ADD_TIMELINE, payload: { dimensionIndex, date: DATE } });
  seed.forEach((entry) =>
    store.dispatch({ type: ADD_ENTRY, payload: { dimensionIndex, date: DATE, ...entry } })
  );
  const entriesIn = () => store.getState().diaries[DATE].timelines[dimensionIndex];
  const commands = new EntryCommands({
    store,
    getDimensionIndex: () => dimensionIndex,
    getCurrentDate: () => DATE,
    getEntries: entriesIn,
  });
  return { store, commands, entriesIn };
}

const home = { id: 0, startOffsetMins: 60, endOffsetMins: 120, activity: 'Home' };
const work = { id: 4, startOffsetMins: 180, endOffsetMins: 240, activity: 'Work' };

describe('EntryCommands', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('create', () => {
    it('adds the entry to this date and Dimension with the next id, and returns it', () => {
      const { commands, entriesIn } = setup(LOCATION, [home, work]);

      const id = commands.create({ startOffsetMins: 300, endOffsetMins: 330, activity: 'Car' });

      expect(id).toBe(5); // one past the highest existing id, not the count
      expect(entriesIn()).toContainEqual({
        id: 5,
        startOffsetMins: 300,
        endOffsetMins: 330,
        activity: 'Car',
      });
    });

    it('starts ids at 0 on an empty Timeline', () => {
      const { commands } = setup();
      expect(commands.create({ startOffsetMins: 0, endOffsetMins: 10, activity: 'Car' })).toBe(0);
    });

    it('dispatches nothing, and returns undefined, without a valid Dimension index', () => {
      const store = createStore(eliddiReducer);
      const dispatch = vi.spyOn(store, 'dispatch');
      const commands = new EntryCommands({
        store,
        getDimensionIndex: () => NaN,
        getCurrentDate: () => DATE,
        getEntries: () => [],
      });

      expect(commands.create({ startOffsetMins: 0, endOffsetMins: 10 })).toBeUndefined();
      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  it('updates the entry with the given id', () => {
    const { commands, entriesIn } = setup(LOCATION, [home, work]);

    commands.update(4, { ...work, endOffsetMins: 270 });

    expect(entriesIn().find((entry) => entry.id === 4).endOffsetMins).toBe(270);
    expect(entriesIn().find((entry) => entry.id === 0)).toEqual(home);
  });

  describe('remove', () => {
    it('removes the entry with the given id, and reports it did', () => {
      const { commands, entriesIn } = setup(LOCATION, [home, work]);

      expect(commands.remove(0)).toBe(true);

      expect(entriesIn()).toEqual([work]);
    });

    it('does nothing, and reports so, for an id that is already gone', () => {
      const { store, commands } = setup(LOCATION, [home]);
      const dispatch = vi.spyOn(store, 'dispatch');

      expect(commands.remove(99)).toBe(false);
      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  describe('findConflict', () => {
    it('finds an overlapping entry in a single-choice Dimension', () => {
      const { commands } = setup(LOCATION, [home]);
      expect(commands.findConflict({ startOffsetMins: 90, endOffsetMins: 150 })).toEqual(home);
    });

    it('treats back-to-back entries as not overlapping', () => {
      const { commands } = setup(LOCATION, [home]);
      expect(commands.findConflict({ startOffsetMins: 120, endOffsetMins: 150 })).toBeUndefined();
    });

    it('ignores the entry being edited', () => {
      const { commands } = setup(LOCATION, [home]);
      expect(
        commands.findConflict({ startOffsetMins: 90, endOffsetMins: 150 }, home.id)
      ).toBeUndefined();
    });

    it('never reports a conflict in a multiple-choice Dimension', () => {
      const { commands } = setup(WHO, [{ ...home, activity: ['Alone'] }]);
      expect(commands.findConflict({ startOffsetMins: 90, endOffsetMins: 150 })).toBeUndefined();
    });
  });

  it('knows whether its Dimension is single-choice', () => {
    expect(setup(LOCATION).commands.isSingleChoiceDimension).toBe(true);
    expect(setup(WHO).commands.isSingleChoiceDimension).toBe(false);
  });

  it('finds the next entry after an offset, skipping the one being edited', () => {
    const { commands } = setup(LOCATION, [home, work]);

    expect(commands.findNextEntryAfter(0)).toEqual(home);
    expect(commands.findNextEntryAfter(0, home.id)).toEqual(work);
    expect(commands.findNextEntryAfter(240)).toBeUndefined();
  });
});

describe('formatOverlapMessage', () => {
  it('names the conflicting entry and its clock times', () => {
    expect(formatOverlapMessage(home)).toMatch(/"Home" entry \(\d\d:\d\d–\d\d:\d\d\)/);
  });
});
