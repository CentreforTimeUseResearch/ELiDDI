import { describe, it, expect, beforeEach } from 'vitest';
import { DatePicker } from './datePicker';
import { appStore } from '../../store/appStore';
import { SWITCH_DATE, SHOW_PANEL } from '../../store/actionTypes';
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
});
