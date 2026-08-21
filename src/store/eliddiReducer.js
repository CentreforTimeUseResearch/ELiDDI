import { combineReducers } from './store';
import { getCurrentDiaryDateKey } from '../utils/time';
import {
  RESET_ONBOARDING,
  DISMISS_ONBOARDING,
  NEXT_INSTRUCTION,
  PREVIOUS_INSTRUCTION,
  SHOW_PANEL,
  HIDE_PANEL,
  SWITCH_DIMENSION,
  RESET_DIMENSION_INDEX,
  SWITCH_DATE,
  ADD_TIMELINE,
  ADD_ENTRY,
  UPDATE_ENTRY,
  DELETE_ENTRY,
  SET_STATUS,
  RESET_STATUS,
  SET_COMPLETE,
} from './actionTypes';

const onboardingStep = (state = 0, action) => {
  switch (action?.type) {
    case NEXT_INSTRUCTION:
      return state + 1; // put in upper bounds from GLOBAL
    case PREVIOUS_INSTRUCTION:
      return state - 1 >= 0 ? state - 1 : 0;
    case RESET_ONBOARDING:
      return 0;
    default:
      return state;
  }
};

const onboarding = (state = true, action) => {
  switch (action?.type) {
    case RESET_ONBOARDING:
      return true;
    case DISMISS_ONBOARDING:
      return false;
    default:
      return state;
  }
};

// in this case we can only show one panel at a time
const uipanel = (state = undefined, action) => {
  switch (action?.type) {
    case SHOW_PANEL:
      return action.payload;
    case HIDE_PANEL:
      return undefined;
    default:
      return state;
  }
};

const currentDimensionIndex = (state = 0, action) => {
  switch (action?.type) {
    case SWITCH_DIMENSION:
      return action.payload;
    case RESET_DIMENSION_INDEX:
      return 0;
    default:
      return state;
  }
};

// per-Dimension Entry[] reducer, one Timeline's worth of Entries
const timeline = (state = [], action) => {
  const { startOffsetMins, endOffsetMins, id, activity, index } = action.payload;
  switch (action?.type) {
    case ADD_ENTRY:
      return [
        ...state,
        {
          startOffsetMins,
          endOffsetMins,
          id,
          activity,
        },
      ];
    case UPDATE_ENTRY:
      return [
        ...state.slice(0, index),
        { startOffsetMins, endOffsetMins, id, activity },
        ...state.slice(index + 1),
      ];
    case DELETE_ENTRY:
      return state.filter((entry) => entry.id !== id);
    default:
      return state;
  }
};

// one Diary's six per-Dimension Timelines. Uses direct index assignment on
// a copied array (not slice-splice) so it's correct regardless of which
// dimension index is touched first - slice-splice only produced correct
// results if every index had been touched at least once in order.
const dimensionTimelines = (state = [], action) => {
  const index = action?.payload?.dimensionIndex;
  if (index === undefined) return state;
  const next = [...state];
  switch (action?.type) {
    case ADD_TIMELINE:
      next[index] = [];
      return next;
    case ADD_ENTRY:
    case UPDATE_ENTRY:
    case DELETE_ENTRY:
      next[index] = timeline(next[index], action);
      return next;
    default:
      return state;
  }
};

// one Diary's status
const diaryStatus = (state = 0, action) => {
  switch (action?.type) {
    case SET_STATUS:
      return state;
    case RESET_STATUS:
      return 0;
    case SET_COMPLETE:
      return '100';
    default:
      return state;
  }
};

// one Diary = its Timelines + its Diary status (see GLOSSARY.md)
const diary = (state = { timelines: [], status: 0 }, action) => ({
  timelines: dimensionTimelines(state.timelines, action),
  status: diaryStatus(state.status, action),
});

// all Diaries, keyed by date (YYYY-MM-DD)
const diaries = (state = {}, action) => {
  const dateKey = action?.payload?.date;
  if (!dateKey) return state;
  switch (action?.type) {
    case ADD_TIMELINE:
    case ADD_ENTRY:
    case UPDATE_ENTRY:
    case DELETE_ENTRY:
    case SET_STATUS:
    case RESET_STATUS:
    case SET_COMPLETE:
      return { ...state, [dateKey]: diary(state[dateKey], action) };
    default:
      return state;
  }
};

// currently-viewed date - persisted like any other diary data (see
// appStore.js), so the default below only matters on the very
// first-ever load, before anything has been persisted
const currentDate = (state = getCurrentDiaryDateKey(), action) => {
  switch (action?.type) {
    case SWITCH_DATE:
      return action.payload;
    default:
      return state;
  }
};

export const eliddiReducer = combineReducers({
  onboarding,
  onboardingStep,
  uipanel,
  currentDimensionIndex,
  currentDate,
  diaries,
});
