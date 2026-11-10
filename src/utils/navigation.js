import { HIDE_PANEL, SWITCH_DATE, SWITCH_DIMENSION } from '../store/actionTypes';
import { addDaysToDateKey, getCurrentDiaryDateKey } from './time';

// What the day and Dimension controls do. The nav bar's buttons and the
// Timelines' keyboard shortcuts both call these, so "the shortcut does the
// same as its button" is true by construction, including the rules about days
// that have not begun and the 04:00 day boundary. Each takes the store.

// the day Previous goes to: one back, but never to a day that has not begun (a
// stored day in the future, which no control can reach, steps down to today)
export function dayBefore(currentDate, today) {
  const before = addDaysToDateKey(currentDate, -1);
  return before > today ? today : before;
}

// switches the day, after closing the details panel (as the date picker does;
// unsaved edits go with it, see DetailsPanelCoordinator's date handling).
// Refuses the day already showing and a day that has not begun, checked now,
// not when a button was drawn, so a page left open across 04:00 still behaves
// -> whether it switched
export function goToDate(store, dateKey) {
  const { currentDate } = store.getState();
  if (dateKey === currentDate || dateKey > getCurrentDiaryDateKey()) {
    return false;
  }
  store.dispatch({ type: HIDE_PANEL });
  store.dispatch({ type: SWITCH_DATE, payload: dateKey });
  return true;
}

// one day back (-1) or on (1) from the day showing
export function stepDay(store, direction) {
  const { currentDate } = store.getState();
  const target =
    direction < 0
      ? dayBefore(currentDate, getCurrentDiaryDateKey())
      : addDaysToDateKey(currentDate, 1); // goToDate refuses a day that has not begun
  return goToDate(store, target);
}

export function goToToday(store) {
  return goToDate(store, getCurrentDiaryDateKey());
}

// the previous (-1) or next (1) Dimension out of `count`, wrapping round, from
// `from` (default: the current one), closing the details panel as choosing a
// Dimension does -> the Dimension now current
export function stepDimension(
  store,
  direction,
  count,
  from = store.getState().currentDimensionIndex
) {
  if (count <= 1) {
    return from;
  }
  const next = (from + direction + count) % count;
  store.dispatch({ type: HIDE_PANEL });
  store.dispatch({ type: SWITCH_DIMENSION, payload: next });
  return next;
}
