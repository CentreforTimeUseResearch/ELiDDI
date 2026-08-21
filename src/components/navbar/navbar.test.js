import { describe, it, expect, beforeEach } from 'vitest';
import { Navbar } from './navbar';
import { appStore } from '../../store/appStore';
import { SWITCH_DATE } from '../../store/actionTypes';

describe('Navbar', () => {
  beforeEach(() => {
    if (!customElements.get('el-nav-bar')) {
      customElements.define('el-nav-bar', Navbar);
    }
    document.body.innerHTML = '';
  });

  it('renders sidebar html', () => {
    const el = document.createElement('el-nav-bar');
    document.body.appendChild(el);
    expect(el.innerHTML).toContain('<div class="off-screen-menu">');
    expect(el.innerHTML).toContain('nav');
  });

  it('toggles active class on sidebar menu and hamburger button when hamburger button clicked', async () => {
    const el = document.createElement('el-nav-bar');
    document.body.appendChild(el);

    expect(el.querySelector('.off-screen-menu').classList.contains('active')).toBe(false);
    expect(el.querySelector('.ham-menu').classList.contains('active')).toBe(false);

    el.querySelector('.ham-menu').click();

    expect(el.querySelector('.off-screen-menu').classList.contains('active')).toBe(true);
    expect(el.querySelector('.ham-menu').classList.contains('active')).toBe(true);

    el.querySelector('.ham-menu').click();
    expect(el.querySelector('.off-screen-menu').classList.contains('active')).toBe(false);
    expect(el.querySelector('.ham-menu').classList.contains('active')).toBe(false);
  });

  it('dispatches SHOW_PANEL with "date" when the Change Date button is clicked', () => {
    const el = document.createElement('el-nav-bar');
    document.body.appendChild(el);

    el.querySelector('.change-date-button').click();

    expect(el.store.getState().uipanel).toBe('date');
  });

  it('shows the currently selected date, formatted as DD/MM/YYYY, on mount', () => {
    appStore.dispatch({ type: SWITCH_DATE, payload: '2026-01-05' });
    const el = document.createElement('el-nav-bar');
    document.body.appendChild(el);

    expect(el.querySelector('.date-indicator').textContent).toBe('Selected day: 05/01/2026 change');
  });

  it('updates the date indicator when the store date changes', () => {
    const el = document.createElement('el-nav-bar');
    document.body.appendChild(el);

    el.store.dispatch({ type: SWITCH_DATE, payload: '2026-12-25' });

    expect(el.querySelector('.date-indicator').textContent).toBe('Selected day: 25/12/2026 change');
  });

  // todo: test that sidebar menu options are present
});
