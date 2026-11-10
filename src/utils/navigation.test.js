import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStore } from '../store/store';
import { eliddiReducer } from '../store/eliddiReducer';
import { SHOW_PANEL, SWITCH_DATE, SWITCH_DIMENSION } from '../store/actionTypes';
import { dayBefore, goToDate, stepDay, goToToday, stepDimension } from './navigation';
import { registerUnsavedEditsGuard } from './unsavedEdits';

// What the day and Dimension controls do, shared by the buttons and the
// keyboard shortcuts so the two cannot differ. "Today" is Monday 9 November
// 2026 at noon, so well past the 04:00 day boundary.
const TODAY = '2026-11-09';

function storeOn(date) {
  const store = createStore(eliddiReducer);
  store.dispatch({ type: SWITCH_DATE, payload: date });
  return store;
}

describe('navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 9, 12, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('dayBefore', () => {
    it('is the day before', () => {
      expect(dayBefore('2026-11-05', TODAY)).toBe('2026-11-04');
      expect(dayBefore(TODAY, TODAY)).toBe('2026-11-08');
    });

    it('never lands on a day that has not begun, even from one', () => {
      expect(dayBefore('2026-11-12', TODAY)).toBe(TODAY);
    });
  });

  describe('goToDate', () => {
    it('closes the panel and switches the day', () => {
      const store = storeOn('2026-11-05');
      store.dispatch({ type: SHOW_PANEL, payload: 'details' });

      const moved = goToDate(store, '2026-11-06');

      expect(moved).toBe(true);
      expect(store.getState().currentDate).toBe('2026-11-06');
      expect(store.getState().uipanel).toBeUndefined();
    });

    it('does nothing for the day already showing, or one that has not begun', () => {
      const store = storeOn('2026-11-05');
      const dispatch = vi.spyOn(store, 'dispatch');

      expect(goToDate(store, '2026-11-05')).toBe(false);
      expect(goToDate(store, '2026-11-10')).toBe(false);

      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  describe('goToDate and unsaved edits', () => {
    it('asks the guard, for every draft, and waits for it', () => {
      const store = storeOn('2026-11-05');
      const guard = vi.fn();
      const unregister = registerUnsavedEditsGuard(guard);

      const switched = goToDate(store, '2026-11-06');

      expect(guard).toHaveBeenCalledWith({ all: true }, expect.any(Function), undefined);
      expect(switched).toBe(false); // asked, did not switch yet
      expect(store.getState().currentDate).toBe('2026-11-05');
      unregister();
    });

    it('switches when the guard lets it go, now or later', () => {
      const store = storeOn('2026-11-05');
      let later;
      const unregister = registerUnsavedEditsGuard((scope, proceed) => {
        later = proceed;
      });

      goToDate(store, '2026-11-06');
      expect(store.getState().currentDate).toBe('2026-11-05');
      later();

      expect(store.getState().currentDate).toBe('2026-11-06');
      expect(store.getState().uipanel).toBeUndefined();
      unregister();
    });

    it('does not even ask about a day that cannot be gone to', () => {
      const store = storeOn('2026-11-05');
      const guard = vi.fn();
      const unregister = registerUnsavedEditsGuard(guard);

      goToDate(store, '2026-11-05'); // already showing
      goToDate(store, '2026-11-12'); // has not begun

      expect(guard).not.toHaveBeenCalled();
      unregister();
    });

    it('is asked for by the day buttons and the shortcuts alike', () => {
      const store = storeOn('2026-11-05');
      const guard = vi.fn();
      const unregister = registerUnsavedEditsGuard(guard);

      stepDay(store, 1);
      stepDay(store, -1);
      goToToday(store);

      expect(guard).toHaveBeenCalledTimes(3);
      unregister();
    });
  });

  describe('stepDay', () => {
    it('goes back and on one day', () => {
      const store = storeOn('2026-11-05');

      stepDay(store, -1);
      expect(store.getState().currentDate).toBe('2026-11-04');
      stepDay(store, 1);
      stepDay(store, 1);
      expect(store.getState().currentDate).toBe('2026-11-06');
    });

    it('stops at today going on', () => {
      const store = storeOn('2026-11-08');

      expect(stepDay(store, 1)).toBe(true);
      expect(store.getState().currentDate).toBe(TODAY);
      expect(stepDay(store, 1)).toBe(false);
      expect(store.getState().currentDate).toBe(TODAY);
    });

    it('follows the 04:00 day boundary: at 02:00 the 8th is still today', () => {
      vi.setSystemTime(new Date(2026, 10, 9, 2, 0));
      const store = storeOn('2026-11-07');

      stepDay(store, 1);
      expect(store.getState().currentDate).toBe('2026-11-08');
      expect(stepDay(store, 1)).toBe(false);
    });

    it('is checked when pressed: once 04:00 has passed the 9th can be reached', () => {
      vi.setSystemTime(new Date(2026, 10, 9, 2, 0));
      const store = storeOn('2026-11-08');
      expect(stepDay(store, 1)).toBe(false);

      vi.setSystemTime(new Date(2026, 10, 9, 4, 0));

      expect(stepDay(store, 1)).toBe(true);
      expect(store.getState().currentDate).toBe(TODAY);
    });
  });

  describe('goToToday', () => {
    it('goes to today from another day, and does nothing on today', () => {
      const store = storeOn('2026-10-01');

      expect(goToToday(store)).toBe(true);
      expect(store.getState().currentDate).toBe(TODAY);
      expect(goToToday(store)).toBe(false);
    });

    it('is the previous date until 04:00', () => {
      vi.setSystemTime(new Date(2026, 10, 9, 3, 59));
      const store = storeOn('2026-10-01');

      goToToday(store);

      expect(store.getState().currentDate).toBe('2026-11-08');
    });
  });

  describe('stepDimension', () => {
    it('goes to the next and previous Dimension, closing the panel', () => {
      const store = createStore(eliddiReducer);
      store.dispatch({ type: SWITCH_DIMENSION, payload: 2 });
      store.dispatch({ type: SHOW_PANEL, payload: 'details' });

      expect(stepDimension(store, 1, 6)).toBe(3);
      expect(store.getState().currentDimensionIndex).toBe(3);
      expect(store.getState().uipanel).toBeUndefined();

      expect(stepDimension(store, -1, 6)).toBe(2);
      expect(store.getState().currentDimensionIndex).toBe(2);
    });

    it('wraps round, either way', () => {
      const store = createStore(eliddiReducer);
      store.dispatch({ type: SWITCH_DIMENSION, payload: 5 });

      expect(stepDimension(store, 1, 6)).toBe(0);
      expect(stepDimension(store, -1, 6)).toBe(5);
    });

    it('goes from the one given, not necessarily the current one', () => {
      const store = createStore(eliddiReducer);
      store.dispatch({ type: SWITCH_DIMENSION, payload: 0 });

      expect(stepDimension(store, 1, 6, 3)).toBe(4);
      expect(store.getState().currentDimensionIndex).toBe(4);
    });

    it('stays put when there is only one Dimension', () => {
      const store = createStore(eliddiReducer);
      const dispatch = vi.spyOn(store, 'dispatch');

      expect(stepDimension(store, 1, 1)).toBe(0);

      expect(dispatch).not.toHaveBeenCalled();
    });
  });
});
