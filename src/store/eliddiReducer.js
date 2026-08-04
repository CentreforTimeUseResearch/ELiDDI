import { combineReducers } from './store';

const onboardingStep = (state = 0, action) => {
  switch (action?.type) {
    case 'NEXT_INSTRUCTION':
      return state + 1; // put in upper bounds from GLOBAL
    case 'PREVIOUS_INSTRUCTION':
      return state - 1 >= 0 ? state - 1 : 0;
    default:
      return state;
  }
};

const onboarding = (state = true, action) => {
  switch (action?.type) {
    case 'RESET_ONBOARDING':
      return true;
    case 'DISMISS_ONBOARDING':
      return false;
    default:
      return state;
  }
};

// in this case we can only show one panel at a time
const uipanel = (state = undefined, action) => {
  switch (action?.type) {
    case 'SHOW_PANEL':
      return action.payload;
    case 'HIDE_PANEL':
      return undefined;
    default:
      return state;
  }
}

const currentTimelineIndex = (state = 0, action) => {
  switch (action?.type) {
    case 'SWITCH_TIMELINE':
      return action.payload;
    case 'RESET_TIMELINE_INDEX':
      return 0;
    default:
      return state;
  }
}

const entry = (state = {}, action) => {
  switch (action?.type) {
    case 'SET_SELECTED_ENTRY_ACTIVITY':
      return ({
        ...state,
        activity: action.activity
      })
    default:
      return state;
  }
}

const timeline = (state = [], action) => {
  switch (action?.type) {
    case 'ADD_ENTRY':
      const { startOffsetMins, endOffsetMins, id } = action.payload;
      return [...state, {
        startOffsetMins, endOffsetMins, id
      }]
    case 'SET_SELECTED_ENTRY_ACTIVITY':
      // find index of select entry using id
      const index = state.findIndex((entry) => entry.id === action.selected_id)

      return [
        ...state.slice(0, index),
        entry(state[index], action),
        ...state.slice(index + 1)
      ]
    default:
      return state
  }
}

const selectedEntry = (state = undefined, action) => {
  switch (action?.type) {
    case 'SELECT_ENTRY':
      return {
        timeline: action.timelineIndex,
        id: action.id
      }
    default:
      return state;
  }
}

const timelines = (state = [], action) => {
  const index = action?.payload?.timelineIndex
  switch (action?.type) {
    case 'ADD_ENTRY':
      return [
        ...state.slice(0, index),
        [...timeline(state[index], action)],
        ...state.slice(index + 1)
      ]
    case 'ADD_TIMELINE':
      return [
        ...state.slice(0, index),
        [],
        ...state.slice(index + 1)
      ]
    case 'SET_SELECTED_ENTRY_ACTIVITY':

      const { timeline_id } = action;
      return [
        ...state.slice(0, timeline_id),
        [...timeline(state[timeline_id], action)],
        ...state.slice(timeline_id + 1)
      ]
    default:
      return state;
  }
}

export const eliddiReducer = combineReducers({
  onboarding,
  onboardingStep,
  uipanel,
  currentTimelineIndex,
  timelines,
  selectedEntry
});
