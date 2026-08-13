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

const currentDimensionIndex = (state = 0, action) => {
  switch (action?.type) {
    case 'SWITCH_DIMENSION':
      return action.payload;
    case 'RESET_DIMENSION_INDEX':
      return 0;
    default:
      return state;
  }
}

const entry = (state = {}, action) => {
  switch (action?.type) {
    default:
      return state;
  }
}

const timeline = (state = [], action) => {
  const { startOffsetMins, endOffsetMins, id, activity, index } = action.payload;
  switch (action?.type) {
    case 'ADD_ENTRY':
      return [...state, {
        startOffsetMins, endOffsetMins, id, activity
      }]
    case "UPDATE_ENTRY":
      return [
        ...state.slice(0, index),
        { startOffsetMins, endOffsetMins, id, activity },
        ...state.slice(index + 1)
      ]
    case 'DELETE_ENTRY':
      return state.filter((entry) => entry.id !== id)
    default:
      return state
  }
}

const selectedEntry = (state = undefined, action) => {
  switch (action?.type) {
    case 'SELECT_ENTRY':
      return {
        dimension: action.dimensionIndex,
        index: action.index
      }
    default:
      return state;
  }
}

const timelines = (state = [], action) => {
  const index = action?.payload?.dimensionIndex
  switch (action?.type) {
    case 'ADD_ENTRY':
    case "UPDATE_ENTRY":
    case 'DELETE_ENTRY':
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
    default:
      return state;
  }
}

const status = (state = 0, action) => {
  switch (action.type) {
    case 'SET_STATUS':
      break;
    case 'RESET_STATUS':
      return 0;
    case 'SET_COMPLETE':
      return '100'
    default:
      return state;
  }
}

export const eliddiReducer = combineReducers({
  onboarding,
  onboardingStep,
  uipanel,
  currentDimensionIndex,
  timelines,
  selectedEntry,
  status,
});
