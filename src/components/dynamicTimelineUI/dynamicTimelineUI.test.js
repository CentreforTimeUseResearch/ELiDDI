import { describe, it, expect, beforeEach, vi } from 'vitest';
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
});
