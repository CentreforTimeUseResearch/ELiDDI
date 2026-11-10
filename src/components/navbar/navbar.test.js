import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { appSession } from '../../auth/session';
import { Navbar } from './navbar';
import { appStore } from '../../store/appStore';
import {
  SWITCH_DATE,
  SWITCH_DIMENSION,
  SET_HORIZONTAL_ZOOM,
  ADD_TIMELINE,
  ADD_ENTRY,
  SET_COMPLETE,
  CLEAR_DIARY,
  SHOW_PANEL,
  HIDE_PANEL,
  DISMISS_ONBOARDING,
} from '../../store/actionTypes';

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

    expect(el.querySelector('.date-text').textContent).toBe('Selected day: 05/01/2026 change');
  });

  it('updates the date indicator when the store date changes', () => {
    const el = document.createElement('el-nav-bar');
    document.body.appendChild(el);

    el.store.dispatch({ type: SWITCH_DATE, payload: '2026-12-25' });

    expect(el.querySelector('.date-text').textContent).toBe('Selected day: 25/12/2026 change');
  });

  // #227: Previous day, Next day and Today beside the date button
  describe('day controls', () => {
    const TODAY = '2026-11-09'; // a Monday

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 9, 12, 0)); // noon: well after the 04:00 day boundary
      appStore.dispatch({ type: HIDE_PANEL });
      appStore.dispatch({ type: SWITCH_DIMENSION, payload: 0 });
      appStore.dispatch({ type: SWITCH_DATE, payload: TODAY });
      // the store is shared: start each test with these days empty
      ['2026-11-08', TODAY].forEach((date) =>
        appStore.dispatch({ type: CLEAR_DIARY, payload: { date } })
      );
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    function mount() {
      const el = document.createElement('el-nav-bar');
      document.body.appendChild(el);
      return el;
    }

    const previous = (el) => el.querySelector('.previous-day-button');
    const next = (el) => el.querySelector('.next-day-button');
    const today = (el) => el.querySelector('.today-button');
    const currentDate = () => appStore.getState().currentDate;
    const isDisabled = (button) => button.getAttribute('aria-disabled') === 'true';
    const reasonOf = (el, button) =>
      el.querySelector(`#${button.getAttribute('aria-describedby')}`)?.textContent;

    it('has the three buttons in a group with the date button', () => {
      const el = mount();

      const group = el.querySelector('.day-controls');
      expect(group.getAttribute('role')).toBe('group');
      expect(group.getAttribute('aria-label')).toBe('Change day');
      expect(group.contains(previous(el))).toBe(true);
      expect(group.contains(next(el))).toBe(true);
      expect(group.contains(today(el))).toBe(true);
      expect(group.contains(el.querySelector('.change-date-button'))).toBe(true);
    });

    it('names each button for the day it goes to', () => {
      appStore.dispatch({ type: SWITCH_DATE, payload: '2026-11-08' }); // Sunday

      const el = mount();

      expect(previous(el).getAttribute('aria-label')).toBe('Previous day, Saturday 7 November');
      expect(next(el).getAttribute('aria-label')).toBe('Next day, Monday 9 November');
      expect(today(el).getAttribute('aria-label')).toBe('Today, Monday 9 November');
    });

    it('keeps those names up to date as the day changes', () => {
      const el = mount();

      previous(el).click();

      expect(previous(el).getAttribute('aria-label')).toBe('Previous day, Saturday 7 November');
      expect(next(el).getAttribute('aria-label')).toBe('Next day, Monday 9 November');
    });

    describe('Previous day', () => {
      it('goes back one day, closing the panel first like the date picker does', () => {
        const el = mount();
        const dispatch = vi.spyOn(appStore, 'dispatch');

        previous(el).click();

        expect(currentDate()).toBe('2026-11-08');
        expect(dispatch.mock.calls.map(([action]) => action.type)).toEqual([
          HIDE_PANEL,
          SWITCH_DATE,
        ]);
      });

      it('crosses a month end', () => {
        appStore.dispatch({ type: SWITCH_DATE, payload: '2026-11-01' });
        const el = mount();

        previous(el).click();

        expect(currentDate()).toBe('2026-10-31');
      });

      it('never lands on a future day, even from one', () => {
        appStore.dispatch({ type: SWITCH_DATE, payload: '2026-11-12' }); // not possible by any control
        const el = mount();

        previous(el).click();

        expect(currentDate()).toBe(TODAY);
      });
    });

    describe('Next day', () => {
      it('goes on one day', () => {
        appStore.dispatch({ type: SWITCH_DATE, payload: '2026-11-05' });
        const el = mount();

        next(el).click();

        expect(currentDate()).toBe('2026-11-06');
      });

      it('can reach today, but is disabled there, with the reason as text', () => {
        appStore.dispatch({ type: SWITCH_DATE, payload: '2026-11-08' });
        const el = mount();
        expect(isDisabled(next(el))).toBe(false);

        next(el).click();

        expect(currentDate()).toBe(TODAY);
        expect(isDisabled(next(el))).toBe(true);
        expect(next(el).getAttribute('aria-label')).toBe('Next day');
        expect(reasonOf(el, next(el))).toBe("You can't fill in days that haven't happened");
        expect(next(el).title).toBe("You can't fill in days that haven't happened");
      });

      it('does nothing when disabled, however it is activated', () => {
        const el = mount();
        const dispatch = vi.spyOn(appStore, 'dispatch');

        next(el).click();
        next(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(dispatch).not.toHaveBeenCalled();
        expect(currentDate()).toBe(TODAY);
      });

      it('stays focusable when disabled, so its reason can be found by keyboard', () => {
        const el = mount();

        expect(next(el).hasAttribute('disabled')).toBe(false);
        expect(next(el).tabIndex).toBe(0);
      });

      it('drops its reason and title when it is enabled again', () => {
        const el = mount();

        previous(el).click();

        expect(isDisabled(next(el))).toBe(false);
        expect(next(el).title).toBe('');
        expect(reasonOf(el, next(el))).toBe('');
      });

      it('is disabled, and never passes today, even if the stored day is in the future', () => {
        appStore.dispatch({ type: SWITCH_DATE, payload: '2026-11-12' });
        const el = mount();

        next(el).click();

        expect(isDisabled(next(el))).toBe(true);
        expect(currentDate()).toBe('2026-11-12');
      });
    });

    describe('Today', () => {
      it('is disabled on today, with the reason as text', () => {
        const el = mount();

        expect(isDisabled(today(el))).toBe(true);
        expect(reasonOf(el, today(el))).toBe('Already showing today');
        expect(today(el).title).toBe('Already showing today');
        const dispatch = vi.spyOn(appStore, 'dispatch');
        today(el).click();
        expect(dispatch).not.toHaveBeenCalled();
      });

      it('returns to today from another day', () => {
        appStore.dispatch({ type: SWITCH_DATE, payload: '2026-10-01' });
        const el = mount();
        expect(isDisabled(today(el))).toBe(false);

        today(el).click();

        expect(currentDate()).toBe(TODAY);
        expect(isDisabled(today(el))).toBe(true);
      });
    });

    describe('around the 04:00 day boundary', () => {
      beforeEach(() => {
        vi.setSystemTime(new Date(2026, 10, 9, 2, 0)); // 02:00 on the 9th: still the 8th's Diary day
      });

      it('counts the previous date as today until 04:00', () => {
        appStore.dispatch({ type: SWITCH_DATE, payload: '2026-11-05' });
        const el = mount();

        today(el).click();

        expect(currentDate()).toBe('2026-11-08');
      });

      it('has no Next day, nor Today, on that day', () => {
        appStore.dispatch({ type: SWITCH_DATE, payload: '2026-11-08' });
        const el = mount();

        expect(isDisabled(next(el))).toBe(true);
        expect(isDisabled(today(el))).toBe(true);
        expect(previous(el).getAttribute('aria-label')).toBe('Previous day, Saturday 7 November');
      });

      it('does not offer the 9th, which has not begun', () => {
        appStore.dispatch({ type: SWITCH_DATE, payload: '2026-11-07' });
        const el = mount();

        next(el).click();
        next(el).click();

        expect(currentDate()).toBe('2026-11-08');
      });

      it('moves on to the 9th once 04:00 has passed', () => {
        appStore.dispatch({ type: SWITCH_DATE, payload: '2026-11-08' });
        const el = mount();
        vi.setSystemTime(new Date(2026, 10, 9, 4, 0));

        next(el).click(); // it re-checks "today" when pressed, not only when drawn

        expect(currentDate()).toBe('2026-11-09');
      });
    });

    it('keeps everything entered on both days', () => {
      appStore.dispatch({ type: ADD_TIMELINE, payload: { dimensionIndex: 0, date: TODAY } });
      appStore.dispatch({
        type: ADD_ENTRY,
        payload: {
          dimensionIndex: 0,
          date: TODAY,
          id: 0,
          startOffsetMins: 0,
          endOffsetMins: 30,
          activity: 'sleeping',
        },
      });
      const before = appStore.getState().diaries[TODAY];
      const el = mount();

      previous(el).click();
      next(el).click();

      expect(currentDate()).toBe(TODAY);
      expect(appStore.getState().diaries[TODAY]).toBe(before);
    });

    it('keeps the selected Dimension and the zoom', () => {
      appStore.dispatch({ type: SWITCH_DIMENSION, payload: 3 });
      appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: 2 });
      const el = mount();

      previous(el).click();

      expect(appStore.getState().currentDimensionIndex).toBe(3);
      expect(appStore.getState().horizontalZoomLevel).toBe(2);
    });

    it('moves one day per activation, with no repeat while held', () => {
      vi.useFakeTimers(); // all timers this time
      const el = mount();

      previous(el).dispatchEvent(new Event('pointerdown', { bubbles: true }));
      vi.advanceTimersByTime(5000);

      expect(currentDate()).toBe(TODAY);

      previous(el).click();
      expect(currentDate()).toBe('2026-11-08');
    });

    it('still opens the date dialog from the date button', () => {
      const el = mount();

      el.querySelector('.change-date-button').click();

      expect(appStore.getState().uipanel).toBe('date');
      appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });
    });

    describe("shows the day's status on the date button", () => {
      const status = (el) => el.querySelector('.day-status').textContent;

      it('is "Not started" until something is entered', () => {
        const el = mount();

        expect(status(el)).toBe('Not started');
      });

      it('is "In progress" once an Entry exists, and updates live', () => {
        const el = mount();
        appStore.dispatch({ type: ADD_TIMELINE, payload: { dimensionIndex: 0, date: TODAY } });
        appStore.dispatch({
          type: ADD_ENTRY,
          payload: {
            dimensionIndex: 0,
            date: TODAY,
            id: 0,
            startOffsetMins: 0,
            endOffsetMins: 30,
            activity: 'sleeping',
          },
        });

        expect(status(el)).toBe('In progress');
      });

      it('is "Complete" once submitted', () => {
        const el = mount();
        appStore.dispatch({ type: ADD_TIMELINE, payload: { dimensionIndex: 0, date: TODAY } });
        appStore.dispatch({ type: SET_COMPLETE, payload: { date: TODAY } });

        expect(status(el)).toBe('Complete');
      });

      it('follows the day shown', () => {
        const el = mount();

        previous(el).click();

        expect(status(el)).toBe('Not started');
      });
    });
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

  // #207: a visible log out / switch person action, only with server accounts
  describe('server accounts', () => {
    const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    let originalGeneral;

    beforeEach(() => {
      originalGeneral = GLOBALS.DATA.general;
      appSession.end('logout');
    });

    afterEach(() => {
      GLOBALS.DATA.general = originalGeneral;
      appSession.end('logout');
      vi.unstubAllGlobals();
    });

    const accountsOn = () => {
      GLOBALS.DATA.general = {
        ...originalGeneral,
        server_accounts: true,
        backend_url: 'https://diary.example.org',
      };
    };

    it('has no log out item when accounts are off', () => {
      const el = document.createElement('el-nav-bar');
      document.body.appendChild(el);

      expect(el.querySelector('.logout-button')).toBeNull();
    });

    it('has a log out item in both copies of the menu when accounts are on', () => {
      accountsOn();
      const el = document.createElement('el-nav-bar');
      document.body.appendChild(el);

      expect(el.querySelector('.menu-list .logout-button').textContent).toBe(
        'Log out (switch person)'
      );
      expect(el.querySelector('.nav-menu-list .logout-button')).not.toBeNull();
    });

    it('ends the login locally at once and tells the server, from either copy', async () => {
      accountsOn();
      const fetchStub = vi.fn().mockResolvedValue({ ok: true, status: 204 });
      vi.stubGlobal('fetch', fetchStub);
      const el = document.createElement('el-nav-bar');
      document.body.appendChild(el);

      for (const selector of ['.nav-menu-list .logout-button', '.menu-list .logout-button']) {
        appSession.start({ token: 'tok', respondentId: 'r-1', expiresAt: FUTURE });

        el.querySelector(selector).click();

        expect(appSession.get()).toBeNull();
      }
      await vi.waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(2));
      expect(fetchStub.mock.calls[0][0]).toBe('https://diary.example.org/logout');
      expect(fetchStub.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    });

    it('has no sync status when accounts are off, and one when they are on', () => {
      const off = document.createElement('el-nav-bar');
      document.body.appendChild(off);
      expect(off.querySelector('el-sync-status')).toBeNull();

      accountsOn();
      const on = document.createElement('el-nav-bar');
      document.body.appendChild(on);
      expect(on.querySelector('el-sync-status')).not.toBeNull();
    });

    it('closes the sidebar drawer when logging out', () => {
      accountsOn();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));
      const el = document.createElement('el-nav-bar');
      document.body.appendChild(el);
      el.querySelector('.ham-menu').click();
      appSession.start({ token: 'tok', respondentId: 'r-1', expiresAt: FUTURE });

      el.querySelector('.menu-list .logout-button').click();

      expect(el.querySelector('.off-screen-menu').classList.contains('active')).toBe(false);
    });
  });
});
