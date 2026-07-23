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

export const eliddiReducer = combineReducers({
  onboarding,
  onboardingStep,
  uipanel,
});
