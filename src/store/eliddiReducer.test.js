import { describe, it, expect } from 'vitest';
import { eliddiReducer } from './eliddiReducer';
import { SET_STATUS, RESET_STATUS, SET_COMPLETE, SWITCH_DATE } from './actionTypes';

const DATE = '2026-08-21';

describe('eliddiReducer - status', () => {
  // regression test: SET_STATUS used to `break` out of its switch with no
  // trailing `return state`, so the reducer fell through the end of the
  // function and returned undefined instead of preserving the current value
  it('preserves the current status on SET_STATUS instead of resetting it', () => {
    const completedState = eliddiReducer(undefined, {
      type: SET_COMPLETE,
      payload: { date: DATE },
    });
    expect(completedState.diaries[DATE].status).toBe('100');

    const afterSetStatus = eliddiReducer(completedState, {
      type: SET_STATUS,
      payload: { date: DATE },
    });
    expect(afterSetStatus.diaries[DATE].status).toBe('100');
  });

  it('resets status back to 0 on RESET_STATUS', () => {
    const completedState = eliddiReducer(undefined, {
      type: SET_COMPLETE,
      payload: { date: DATE },
    });
    const resetState = eliddiReducer(completedState, {
      type: RESET_STATUS,
      payload: { date: DATE },
    });
    expect(resetState.diaries[DATE].status).toBe(0);
  });

  it('tracks status independently per date', () => {
    const otherDate = '2026-08-22';
    const state = eliddiReducer(undefined, { type: SET_COMPLETE, payload: { date: DATE } });

    expect(state.diaries[DATE].status).toBe('100');
    expect(state.diaries[otherDate]).toBeUndefined();
  });
});

describe('eliddiReducer - currentDate', () => {
  it('switches the current date on SWITCH_DATE', () => {
    const state = eliddiReducer(undefined, { type: SWITCH_DATE, payload: DATE });
    expect(state.currentDate).toBe(DATE);
  });
});
