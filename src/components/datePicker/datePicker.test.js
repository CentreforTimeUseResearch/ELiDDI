import { describe, it, expect, beforeEach } from 'vitest';
import { DatePicker } from './datePicker';
import { appStore } from '../../store/appStore';
import { SWITCH_DATE, SHOW_PANEL } from '../../store/actionTypes';

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
    input.value = '2026-08-22';
    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(appStore.getState().currentDate).toBe('2026-08-22');
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
});
