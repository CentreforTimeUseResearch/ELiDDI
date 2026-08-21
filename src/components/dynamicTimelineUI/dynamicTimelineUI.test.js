import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DynamicTimelineUI } from './dynamicTimelineUI.js';
import { appStore } from '../../store/appStore';
import {
  DISMISS_ONBOARDING,
  RESET_ONBOARDING,
  SHOW_PANEL,
  HIDE_PANEL,
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
  // upgrade every child tag (el-nav-bar, el-timeline-stack, el-dialog) and
  // cascade into their full render trees, which need DOM/markup (e.g. the
  // #svg-timeline <template> in index.html) this unit test isn't set up to
  // provide.
  it('renders el-nav-bar, timeline-stack, and both dialogs', () => {
    const el = document.createElement('el-dynamic-timeline');
    el.render();
    expect(el.innerHTML).toContain('<el-nav-bar>');
    expect(el.innerHTML).toContain('<el-timeline-stack>');
    expect(el.innerHTML).toContain('id="dialog"');
    expect(el.innerHTML).toContain('id="date-dialog"');
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

    it('closes the date dialog when uipanel is anything else', () => {
      appStore.dispatch({ type: SHOW_PANEL, payload: 'activity' });
      const el = createUnmounted();

      el.onStoreUpdate();

      expect(el.dateDialogActions.close).toHaveBeenCalledOnce();
      expect(el.dateDialogActions.open).not.toHaveBeenCalled();
    });
  });
});
