import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { appSession } from '../../auth/session';
import { appSyncStatus, SYNC_STATUS } from '../../sync/syncStatus';
import { getProps } from '../propsRegistry';
import { DynamicTimelineUI } from './dynamicTimelineUI.js';
import { appStore } from '../../store/appStore';
import {
  DISMISS_ONBOARDING,
  RESET_ONBOARDING,
  SHOW_PANEL,
  HIDE_PANEL,
  SET_DESKTOP_LAYOUT,
  ADD_ENTRY,
} from '../../store/actionTypes';

describe('DynamicTimelineUI', () => {
  beforeEach(() => {
    if (!customElements.get('el-dynamic-timeline')) {
      customElements.define('el-dynamic-timeline', DynamicTimelineUI);
    }
    document.body.innerHTML = '';
    appStore.dispatch({ type: RESET_ONBOARDING });
    appStore.dispatch({ type: HIDE_PANEL });
  });

  // render() is checked on a disconnected instance - connecting it would
  // upgrade every child tag (el-nav-bar, el-dialog) and cascade into their
  // full render trees, which need DOM/markup (e.g. the #svg-timeline
  // <template> in index.html) this unit test isn't set up to provide. The
  // stack itself isn't rendered by render() directly any more - see
  // renderStack()/#stack-container below.
  it('renders el-nav-bar, an empty stack container, and both dialogs', () => {
    const el = document.createElement('el-dynamic-timeline');
    el.render();
    expect(el.innerHTML).toContain('<el-nav-bar>');
    expect(el.innerHTML).toContain('id="stack-container"');
    expect(el.innerHTML).toContain('id="dialog"');
    expect(el.innerHTML).toContain('id="date-dialog"');
    expect(el.stackContainer).not.toBeNull();
  });

  // #114: confirming in the reset dialog clears only the viewed day
  describe('reset dialog', () => {
    it('clears the current Diary and closes the dialog when confirmed', () => {
      const date = appStore.getState().currentDate;
      appStore.dispatch({
        type: ADD_ENTRY,
        payload: {
          date,
          dimensionIndex: 0,
          id: 1,
          startOffsetMins: 0,
          endOffsetMins: 10,
          activity: 'x',
        },
      });
      appStore.dispatch({ type: SHOW_PANEL, payload: 'reset' });
      const el = document.createElement('el-dynamic-timeline');
      el.render();

      // the dialog's content only exists once <el-dialog> is connected, so
      // stand in for the confirm button it would render
      const confirm = document.createElement('button');
      confirm.setAttribute('data-confirm-reset', '');
      el.querySelector('#reset-dialog').appendChild(confirm);

      confirm.click();

      expect(appStore.getState().diaries[date].timelines[0]).toEqual([]);
      expect(appStore.getState().uipanel).toBeUndefined();
    });
  });

  // renderStack() swaps #stack-container's contents without touching
  // anything else in the tree - checked directly (not via onStoreUpdate)
  // since it doesn't itself need onboardingDialogActions/dateDialogActions
  describe('renderStack', () => {
    function createRendered() {
      const el = document.createElement('el-dynamic-timeline');
      el.render();
      return el;
    }

    it('mounts el-timeline-stack when isDesktopLayout is false', () => {
      const el = createRendered();
      el.isDesktopLayout = false;

      el.renderStack();

      expect(el.stackContainer.innerHTML).toBe('<el-timeline-stack></el-timeline-stack>');
    });

    it('mounts el-horizontal-timeline-stack when isDesktopLayout is true', () => {
      const el = createRendered();
      el.isDesktopLayout = true;

      el.renderStack();

      expect(el.stackContainer.innerHTML).toBe(
        '<el-horizontal-timeline-stack></el-horizontal-timeline-stack>'
      );
    });
  });

  // regression coverage for DynamicTimelineUI now owning onboarding state
  // (rather than DialogWidget reading it directly) and, per Phase 9, the
  // date panel's open/closed state too - drive onStoreUpdate() directly
  // against stubbed dialog actions, same approach timeline.test.js uses for
  // onTimelineClick/saveEntry, to avoid mounting the full child tree.
  describe('onStoreUpdate', () => {
    function createUnmounted() {
      const el = document.createElement('el-dynamic-timeline');
      el.onboardingDialogActions = { open: vi.fn(), close: vi.fn() };
      el.dateDialogActions = { open: vi.fn(), close: vi.fn() };
      el.resetDialogActions = { open: vi.fn(), close: vi.fn() };
      el.stackContainer = document.createElement('div');
      return el;
    }

    it('opens the onboarding dialog when onboarding is active', () => {
      appStore.dispatch({ type: RESET_ONBOARDING }); // onboarding: true
      const el = createUnmounted();

      el.onStoreUpdate();

      expect(el.onboardingDialogActions.open).toHaveBeenCalledOnce();
      expect(el.onboardingDialogActions.close).not.toHaveBeenCalled();
    });

    it('closes the onboarding dialog once onboarding has been dismissed', () => {
      appStore.dispatch({ type: DISMISS_ONBOARDING });
      const el = createUnmounted();

      el.onStoreUpdate();

      expect(el.onboardingDialogActions.close).toHaveBeenCalledOnce();
      expect(el.onboardingDialogActions.open).not.toHaveBeenCalled();
    });

    it('opens the date dialog when uipanel is "date"', () => {
      appStore.dispatch({ type: SHOW_PANEL, payload: 'date' });
      const el = createUnmounted();

      el.onStoreUpdate();

      expect(el.dateDialogActions.open).toHaveBeenCalledOnce();
      expect(el.dateDialogActions.close).not.toHaveBeenCalled();
    });

    it('opens the reset dialog when uipanel is "reset", and closes it otherwise', () => {
      const el = createUnmounted();

      appStore.dispatch({ type: SHOW_PANEL, payload: 'reset' });
      el.onStoreUpdate();
      expect(el.resetDialogActions.open).toHaveBeenCalledOnce();

      appStore.dispatch({ type: HIDE_PANEL });
      el.onStoreUpdate();
      expect(el.resetDialogActions.close).toHaveBeenCalledOnce();
    });

    it('closes the date dialog when uipanel is anything else', () => {
      appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });
      const el = createUnmounted();

      el.onStoreUpdate();

      expect(el.dateDialogActions.close).toHaveBeenCalledOnce();
      expect(el.dateDialogActions.open).not.toHaveBeenCalled();
    });

    // Phase 10.4: the stack swap itself - only re-render #stack-container on
    // an actual isDesktopLayout crossing, never on an unrelated store update
    it('mounts the horizontal stack on the first update when isDesktopLayout is already true', () => {
      appStore.dispatch({ type: SET_DESKTOP_LAYOUT, payload: true });
      const el = createUnmounted();

      el.onStoreUpdate();

      expect(el.stackContainer.innerHTML).toBe(
        '<el-horizontal-timeline-stack></el-horizontal-timeline-stack>'
      );
    });

    it('swaps from the vertical to the horizontal stack when isDesktopLayout turns true', () => {
      appStore.dispatch({ type: SET_DESKTOP_LAYOUT, payload: false });
      const el = createUnmounted();
      el.onStoreUpdate();
      expect(el.stackContainer.innerHTML).toBe('<el-timeline-stack></el-timeline-stack>');

      appStore.dispatch({ type: SET_DESKTOP_LAYOUT, payload: true });
      el.onStoreUpdate();

      expect(el.stackContainer.innerHTML).toBe(
        '<el-horizontal-timeline-stack></el-horizontal-timeline-stack>'
      );
    });

    it('does not re-render the stack container on an update where isDesktopLayout is unchanged', () => {
      appStore.dispatch({ type: SET_DESKTOP_LAYOUT, payload: false });
      const el = createUnmounted();
      el.onStoreUpdate();
      el.stackContainer.innerHTML = '<div data-sentinel="untouched"></div>'; // simulate live stack state

      appStore.dispatch({ type: SHOW_PANEL, payload: 'details' }); // unrelated update
      el.onStoreUpdate();

      expect(el.stackContainer.querySelector('[data-sentinel]')).not.toBeNull();
    });
  });

  // #207: with server accounts on, nothing is shown until the Respondent logs in
  describe('server accounts', () => {
    const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    let originalGeneral;

    const withAccounts = (on) => {
      GLOBALS.DATA.general = on
        ? { ...originalGeneral, server_accounts: true, backend_url: 'https://diary.example.org' }
        : { ...originalGeneral };
    };
    const create = () => {
      const el = document.createElement('el-dynamic-timeline');
      el.render();
      el.onboardingDialogActions = { open: vi.fn(), close: vi.fn() };
      el.dateDialogActions = { open: vi.fn(), close: vi.fn() };
      el.resetDialogActions = { open: vi.fn(), close: vi.fn() };
      el.loginDialogActions = { open: vi.fn(), close: vi.fn() };
      el.stackContainer = document.createElement('div');
      return el;
    };

    beforeEach(() => {
      originalGeneral = GLOBALS.DATA.general;
      appSession.end('logout');
    });

    afterEach(() => {
      GLOBALS.DATA.general = originalGeneral;
      appSession.end('logout');
    });

    it('adds no login dialog, and nothing else, when accounts are off', () => {
      withAccounts(false);
      const el = create();

      expect(el.innerHTML).not.toContain('login-dialog');
      expect(el.hasAttribute('data-login-required')).toBe(false);
    });

    it('renders a login dialog when accounts are on', () => {
      withAccounts(true);
      const el = create();

      const dialog = el.querySelector('#login-dialog');
      expect(dialog).not.toBeNull();
      // the dialog's own markup only exists once it is connected, so check what it was given
      const props = getProps(dialog.getAttribute('key'));
      expect(props.content).toBe('<el-login></el-login>');
      expect(props.dismissible).toBe(false);
    });

    it('opens the login dialog and hides the diary while nobody is logged in', () => {
      withAccounts(true);
      const el = create();

      el.onStoreUpdate();

      expect(el.loginDialogActions.open).toHaveBeenCalled();
      expect(el.loginDialogActions.close).not.toHaveBeenCalled();
      expect(el.hasAttribute('data-login-required')).toBe(true);
    });

    it('holds back the onboarding until the Respondent has logged in', () => {
      withAccounts(true);
      appStore.dispatch({ type: RESET_ONBOARDING }); // onboarding: true
      const el = create();

      el.onStoreUpdate();

      expect(el.onboardingDialogActions.open).not.toHaveBeenCalled();
      expect(el.onboardingDialogActions.close).toHaveBeenCalled();
    });

    it('closes the login dialog, shows the diary and then the onboarding once logged in', () => {
      withAccounts(true);
      appStore.dispatch({ type: RESET_ONBOARDING });
      const el = create();
      appSession.start({ token: 't', respondentId: 'r-1', expiresAt: FUTURE });

      el.onStoreUpdate();

      expect(el.loginDialogActions.close).toHaveBeenCalled();
      expect(el.loginDialogActions.open).not.toHaveBeenCalled();
      expect(el.hasAttribute('data-login-required')).toBe(false);
      expect(el.onboardingDialogActions.open).toHaveBeenCalled();
    });

    it('goes back to the login dialog when the login ends', () => {
      withAccounts(true);
      const el = create();
      appSession.start({ token: 't', respondentId: 'r-1', expiresAt: FUTURE });
      el.onStoreUpdate();

      appSession.end('logout');
      el.onStoreUpdate();

      expect(el.hasAttribute('data-login-required')).toBe(true);
      expect(el.loginDialogActions.open).toHaveBeenCalled();
    });

    // #208: the diary is not shown until the Respondent's own copy has arrived
    it.each([SYNC_STATUS.LOADING, SYNC_STATUS.LOAD_FAILED, SYNC_STATUS.OUTDATED])(
      'keeps the diary hidden and the dialog up while the diary is %s, though logged in',
      (status) => {
        withAccounts(true);
        appStore.dispatch({ type: RESET_ONBOARDING });
        const el = create();
        appSession.start({ token: 't', respondentId: 'r-1', expiresAt: FUTURE });
        appSyncStatus.set(status);

        el.onStoreUpdate();

        expect(el.hasAttribute('data-login-required')).toBe(true);
        expect(el.loginDialogActions.open).toHaveBeenCalled();
        expect(el.onboardingDialogActions.open).not.toHaveBeenCalled();
        appSyncStatus.set(SYNC_STATUS.IDLE);
      }
    );

    it('shows the diary once it has loaded, whether it is saved or still sending', () => {
      withAccounts(true);
      const el = create();
      appSession.start({ token: 't', respondentId: 'r-1', expiresAt: FUTURE });

      [SYNC_STATUS.SAVED, SYNC_STATUS.SAVING, SYNC_STATUS.UNSAVED, SYNC_STATUS.REJECTED].forEach(
        (status) => {
          appSyncStatus.set(status);
          el.onStoreUpdate();
          expect(el.hasAttribute('data-login-required')).toBe(false);
        }
      );
      appSyncStatus.set(SYNC_STATUS.IDLE);
    });

    it('does not touch the login dialog when accounts are off', () => {
      withAccounts(false);
      const el = create();

      el.onStoreUpdate();

      expect(el.loginDialogActions.open).not.toHaveBeenCalled();
      expect(el.loginDialogActions.close).not.toHaveBeenCalled();
    });
  });
});
