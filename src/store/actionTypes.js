// Single source of truth for store action type strings. Import these
// instead of hand-typing the string at both the dispatch call site and the
// reducer's case branch - a typo or rename in one place used to silently
// desync from the other with no error, just a state update that never happened.

export const RESET_ONBOARDING = 'RESET_ONBOARDING';
export const DISMISS_ONBOARDING = 'DISMISS_ONBOARDING';
export const NEXT_INSTRUCTION = 'NEXT_INSTRUCTION';
export const PREVIOUS_INSTRUCTION = 'PREVIOUS_INSTRUCTION';

export const SHOW_PANEL = 'SHOW_PANEL';
export const HIDE_PANEL = 'HIDE_PANEL';

export const SWITCH_DIMENSION = 'SWITCH_DIMENSION';
export const RESET_DIMENSION_INDEX = 'RESET_DIMENSION_INDEX';

export const SWITCH_DATE = 'SWITCH_DATE';

export const ADD_TIMELINE = 'ADD_TIMELINE';
export const ADD_ENTRY = 'ADD_ENTRY';
export const UPDATE_ENTRY = 'UPDATE_ENTRY';
export const DELETE_ENTRY = 'DELETE_ENTRY';

export const SET_STATUS = 'SET_STATUS';
export const RESET_STATUS = 'RESET_STATUS';
export const SET_COMPLETE = 'SET_COMPLETE';
