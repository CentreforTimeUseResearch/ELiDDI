import { combineReducers } from './store';
import { DIARY_STATUS } from './diaryStatus';
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
  SET_DESKTOP_LAYOUT,
  SET_HORIZONTAL_ZOOM,
  ADD_TIMELINE,
  ADD_ENTRY,
  UPDATE_ENTRY,
  DELETE_ENTRY,
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

// transient viewport state (Phase 10.4) - driven by watchDesktopBreakpoint
// (src/utils/breakpoint.js), not diary data, so excluded from persistence
// (see appStore.js) same as uipanel/currentDimensionIndex above
const isDesktopLayout = (state = false, action) => {
  switch (action?.type) {
    case SET_DESKTOP_LAYOUT:
      return action.payload;
    default:
      return state;
  }
};

// transient viewport state (Phase 10.5), same treatment as isDesktopLayout
// above - not diary data, so excluded from persistence (see appStore.js).
// 1 = native scale (PX_PER_MINUTE); set by HorizontalTimelineAxis's zoom
// buttons (src/components/horizontalTimelineAxis/zoomConstants.js)
const horizontalZoomLevel = (state = 1, action) => {
  switch (action?.type) {
    case SET_HORIZONTAL_ZOOM:
      return action.payload;
    default:
      return state;
  }
};

// the stored Entry shape - picks only these fields off a payload, which
// also carries routing fields (date, dimensionIndex)
const toEntry = ({ startOffsetMins, endOffsetMins, id, activity }) => ({
  startOffsetMins,
  endOffsetMins,
  id,
  activity,
});

// per-Dimension Entry[] reducer, one Timeline's worth of Entries. Entries
// are addressed by id, never by array position - a position computed by a
// caller can be stale by the time it gets here
const timeline = (state = [], action) => {
  const payload = action?.payload;
  if (!payload) return state;
  switch (action.type) {
    case ADD_ENTRY:
      return [...state, toEntry(payload)];
    case UPDATE_ENTRY:
      if (!state.some((entry) => entry.id === payload.id)) {
        return state; // nothing to update - e.g. deleted since it was selected
      }
      return state.map((entry) => (entry.id === payload.id ? toEntry(payload) : entry));
    case DELETE_ENTRY:
      return state.filter((entry) => entry.id !== payload.id);
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

// one Diary's status - see diaryStatus.js
const diaryStatus = (state = DIARY_STATUS.IN_PROGRESS, action) => {
  switch (action?.type) {
    case RESET_STATUS:
      return DIARY_STATUS.IN_PROGRESS;
    case SET_COMPLETE:
      return DIARY_STATUS.COMPLETE;
    default:
      return state;
  }
};

// one Diary = its Timelines + its Diary status (see CONTEXT.md)
const diary = (state = { timelines: [], status: DIARY_STATUS.IN_PROGRESS }, action) => ({
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
  isDesktopLayout,
  horizontalZoomLevel,
  currentDate,
  diaries,
});
