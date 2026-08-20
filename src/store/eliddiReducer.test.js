import { describe, it, expect } from 'vitest';
import { eliddiReducer } from './eliddiReducer';
import { SET_STATUS, RESET_STATUS, SET_COMPLETE } from './actionTypes';

describe('eliddiReducer - status', () => {
  // regression test: SET_STATUS used to `break` out of its switch with no
  // trailing `return state`, so the reducer fell through the end of the
  // function and returned undefined instead of preserving the current value
  it('preserves the current status on SET_STATUS instead of resetting it', () => {
    const completedState = eliddiReducer(undefined, { type: SET_COMPLETE });
    expect(completedState.status).toBe('100');

    const afterSetStatus = eliddiReducer(completedState, { type: SET_STATUS });
    expect(afterSetStatus.status).toBe('100');
  });

  it('resets status back to 0 on RESET_STATUS', () => {
    const completedState = eliddiReducer(undefined, { type: SET_COMPLETE });
    const resetState = eliddiReducer(completedState, { type: RESET_STATUS });
    expect(resetState.status).toBe(0);
  });
});
