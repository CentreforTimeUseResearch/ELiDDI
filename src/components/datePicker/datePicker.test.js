import { describe, it, expect, beforeEach } from 'vitest';
import { DatePicker } from './datePicker';
import { appStore } from '../../store/appStore';
import {
  SWITCH_DATE,
  SHOW_PANEL,
  ADD_TIMELINE,
  ADD_ENTRY,
  SET_COMPLETE,
  CLEAR_DIARY,
} from '../../store/actionTypes';
import { getCurrentDiaryDateKey } from '../../utils/time';

describe('DatePicker', () => {
  beforeEach(() => {
    if (!customElements.get('el-date-picker')) {
      customElements.define('el-date-picker', DatePicker);
    }
    document.body.innerHTML = '';
    appStore.dispatch({ type: SWITCH_DATE, payload: '2026-08-21' });
  });

  it('renders the store current date as the input value', () => {
    const el = document.createElement('el-date-picker');
    document.body.appendChild(el);

    expect(el.querySelector('[data-date-picker]').value).toBe('2026-08-21');
  });

  it('dispatches SWITCH_DATE with the chosen date and hides the panel on change', () => {
    const el = document.createElement('el-date-picker');
    document.body.appendChild(el);

    const input = el.querySelector('[data-date-picker]');
    input.value = '2000-01-05';
    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(appStore.getState().currentDate).toBe('2000-01-05');
    expect(appStore.getState().uipanel).toBeUndefined();
  });

  it('re-renders with the new date if currentDate changes elsewhere while mounted', () => {
    const el = document.createElement('el-date-picker');
    document.body.appendChild(el);

    appStore.dispatch({ type: SWITCH_DATE, payload: '2026-08-25' });

    expect(el.querySelector('[data-date-picker]').value).toBe('2026-08-25');
  });

  // regression guard: opening the date panel (as the navbar's Change Date
  // button does) shouldn't itself move the current date
  it('does not change currentDate just because the panel is shown', () => {
    appStore.dispatch({ type: SHOW_PANEL, payload: 'date' });
    expect(appStore.getState().currentDate).toBe('2026-08-21');
  });

  it('sets max to the current diary date, so the native picker cannot offer a future date', () => {
    const el = document.createElement('el-date-picker');
    document.body.appendChild(el);

    expect(el.querySelector('[data-date-picker]').max).toBe(getCurrentDiaryDateKey());
  });

  it('rejects a future date typed/scripted past the max, leaving currentDate unchanged', () => {
    const el = document.createElement('el-date-picker');
    document.body.appendChild(el);

    const input = el.querySelector('[data-date-picker]');
    // built from local date parts (not toISOString, which converts to UTC
    // and could land back on "today" depending on timezone) - +2 days is a
    // safe margin past whatever getCurrentDiaryDateKey() considers "today"
    const future = new Date();
    future.setDate(future.getDate() + 2);
    const year = future.getFullYear();
    const month = String(future.getMonth() + 1).padStart(2, '0');
    const day = String(future.getDate()).padStart(2, '0');
    input.value = `${year}-${month}-${day}`;
    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(appStore.getState().currentDate).toBe('2026-08-21');
    // input display resets back to the last valid date rather than
    // showing the rejected future one
    expect(el.querySelector('[data-date-picker]').value).toBe('2026-08-21');
  });

  // #274: a native date input cannot show a day's progress, so the days are listed
  describe('the days, with their status', () => {
    const choices = (el) =>
      [...el.querySelectorAll('[data-day]')].map((b) => [b.dataset.day, b.textContent.trim()]);

    beforeEach(() => {
      appStore.dispatch({ type: CLEAR_DIARY, payload: { date: '2026-08-21' } });
    });

    it('lists each known day with Not started / In progress / Complete', () => {
      appStore.dispatch({ type: ADD_TIMELINE, payload: { dimensionIndex: 0, date: '2026-08-20' } });
      appStore.dispatch({
        type: ADD_ENTRY,
        payload: {
          dimensionIndex: 0,
          date: '2026-08-20',
          id: 0,
          startOffsetMins: 0,
          endOffsetMins: 30,
          activity: 'sleeping',
        },
      });
      appStore.dispatch({ type: ADD_TIMELINE, payload: { dimensionIndex: 0, date: '2026-08-19' } });
      appStore.dispatch({ type: SET_COMPLETE, payload: { date: '2026-08-19' } });
      const el = document.createElement('el-date-picker');
      document.body.appendChild(el);

      const list = Object.fromEntries(choices(el));
      expect(list['2026-08-19']).toBe('19/08/2026: Complete');
      expect(list['2026-08-20']).toBe('20/08/2026: In progress');
      expect(list['2026-08-21']).toBe('21/08/2026: Not started');
    });

    it('marks the day showing, and never lists a day that has not begun', () => {
      const el = document.createElement('el-date-picker');
      document.body.appendChild(el);

      expect(el.querySelector('[aria-current="date"]').dataset.day).toBe('2026-08-21');
      const today = getCurrentDiaryDateKey();
      expect(choices(el).every(([day]) => day <= today)).toBe(true);
    });

    it('switches to a day when it is chosen', () => {
      appStore.dispatch({ type: ADD_TIMELINE, payload: { dimensionIndex: 0, date: '2026-08-20' } });
      const el = document.createElement('el-date-picker');
      document.body.appendChild(el);

      el.querySelector('[data-day="2026-08-20"]').click();

      expect(appStore.getState().currentDate).toBe('2026-08-20');
    });

    it('updates a status as entries are made', () => {
      const el = document.createElement('el-date-picker');
      document.body.appendChild(el);
      appStore.dispatch({ type: ADD_TIMELINE, payload: { dimensionIndex: 0, date: '2026-08-21' } });
      appStore.dispatch({
        type: ADD_ENTRY,
        payload: {
          dimensionIndex: 0,
          date: '2026-08-21',
          id: 0,
          startOffsetMins: 0,
          endOffsetMins: 30,
          activity: 'sleeping',
        },
      });

      expect(Object.fromEntries(choices(el))['2026-08-21']).toBe('21/08/2026: In progress');
    });
  });
});
