import { describe, it, expect, beforeEach } from 'vitest';
import { Navbar } from './navbar';
import { appStore } from '../../store/appStore';
import { SWITCH_DATE, DISMISS_ONBOARDING } from '../../store/actionTypes';

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

  // #115
  const MENU_LABELS = ['Instructions', 'Reset (clears this day)', 'View stats', 'About this study'];
  const labelsIn = (el, listSelector) =>
    [...el.querySelectorAll(`${listSelector} li`)].map((li) => li.textContent.trim());

  it.each([
    ['sidebar', '.menu-list[data-menu="generic"]'],
    ['nav bar', '.nav-menu-list'],
  ])('lists every menu option, in order, in the %s', (_, listSelector) => {
    const el = document.createElement('el-nav-bar');
    document.body.appendChild(el);

    expect(labelsIn(el, listSelector)).toEqual(MENU_LABELS);
  });

  it.each([
    ['sidebar', '.menu-list[data-menu="generic"]'],
    ['nav bar', '.nav-menu-list'],
  ])(
    'makes only the wired-up options (Instructions, Reset) buttons in the %s',
    (_, listSelector) => {
      const el = document.createElement('el-nav-bar');
      document.body.appendChild(el);

      const buttons = [...el.querySelectorAll(`${listSelector} li button`)].map((b) =>
        b.textContent.trim()
      );

      expect(buttons).toEqual(['Instructions', 'Reset (clears this day)']);
    }
  );

  it.each([
    ['Instructions', '.instructions-button'],
    ['Reset', '.reset-diary-button'],
  ])('closes the open sidebar when its %s option is chosen', (_, buttonSelector) => {
    const el = document.createElement('el-nav-bar');
    document.body.appendChild(el);
    el.querySelector('.ham-menu').click();

    el.querySelector(`.menu-list ${buttonSelector}`).click();

    expect(el.querySelector('.off-screen-menu').classList.contains('active')).toBe(false);
    expect(el.querySelector('.ham-menu').classList.contains('active')).toBe(false);
  });

  it('renders the generic menu items twice - once in the sidebar, once duplicated into the nav bar - for the >=1024px CSS-only switch', () => {
    const el = document.createElement('el-nav-bar');
    document.body.appendChild(el);

    const sidebarButtons = el.querySelectorAll(
      '.menu-list[data-menu="generic"] .instructions-button'
    );
    const navButtons = el.querySelectorAll('.nav-menu-list .instructions-button');
    expect(sidebarButtons.length).toBe(1);
    expect(navButtons.length).toBe(1);
  });

  it("dispatches RESET_ONBOARDING when the nav bar's duplicated Instructions button is clicked, same as the sidebar one", () => {
    appStore.dispatch({ type: DISMISS_ONBOARDING });
    const el = document.createElement('el-nav-bar');
    document.body.appendChild(el);

    el.querySelector('.nav-menu-list .instructions-button').click();

    expect(el.store.getState().onboarding).toBe(true);
  });

  it('asks to reset (SHOW_PANEL reset) from either copy of the Reset item, clearing nothing itself', () => {
    const el = document.createElement('el-nav-bar');
    document.body.appendChild(el);
    const before = el.store.getState().diaries;

    el.querySelector('.nav-menu-list .reset-diary-button').click();

    expect(el.store.getState().uipanel).toBe('reset');
    expect(el.store.getState().diaries).toBe(before);
    el.store.dispatch({ type: 'HIDE_PANEL' });
    el.querySelector('.menu-list .reset-diary-button').click();
    expect(el.store.getState().uipanel).toBe('reset');
  });

  // the Dimension labels moved beside the timeline rows (HorizontalTimelineStack)
  it('does not render a Dimension list, which the desktop timeline rows carry instead', () => {
    const el = document.createElement('el-nav-bar');
    document.body.appendChild(el);

    expect(el.querySelector('[data-dimension-index]')).toBeNull();
  });
});
