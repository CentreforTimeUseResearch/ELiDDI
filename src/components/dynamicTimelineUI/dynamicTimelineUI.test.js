import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DynamicTimelineUI } from './dynamicTimelineUI.js';
import { appStore } from '../../store/appStore';
import { DISMISS_ONBOARDING, RESET_ONBOARDING } from '../../store/actionTypes';

describe('DynamicTimelineUI', () => {
  beforeEach(() => {
    if (!customElements.get('el-dynamic-timeline')) {
      customElements.define('el-dynamic-timeline', DynamicTimelineUI);
    }
    document.body.innerHTML = '';
    appStore.dispatch({ type: RESET_ONBOARDING });
  });

  // render() is checked on a disconnected instance - connecting it would
  // upgrade every child tag (el-nav-bar, el-timeline-stack, el-dialog) and
  // cascade into their full render trees, which need DOM/markup (e.g. the
  // #svg-timeline <template> in index.html) this unit test isn't set up to
  // provide.
  it('renders el-nav-bar, timeline-stack, and dialog', () => {
    const el = document.createElement('el-dynamic-timeline');
    el.render();
    expect(el.innerHTML).toContain('<el-nav-bar>');
    expect(el.innerHTML).toContain('<el-timeline-stack>');
    expect(el.innerHTML).toContain('<el-dialog');
  });

  // regression coverage for DynamicTimelineUI now owning onboarding state
  // (rather than DialogWidget reading it directly): drive onStoreUpdate()
  // directly against a stubbed dialogActions, same approach timeline.test.js
  // uses for onTimelineClick/saveEntry, to avoid mounting the full child tree.
  describe('onStoreUpdate', () => {
    function createUnmounted() {
      const el = document.createElement('el-dynamic-timeline');
      el.dialogActions = { open: vi.fn(), close: vi.fn() };
      return el;
    }

    it('opens the dialog when onboarding is active', () => {
      appStore.dispatch({ type: RESET_ONBOARDING }); // onboarding: true
      const el = createUnmounted();

      el.onStoreUpdate();

      expect(el.dialogActions.open).toHaveBeenCalledOnce();
      expect(el.dialogActions.close).not.toHaveBeenCalled();
    });

    it('closes the dialog once onboarding has been dismissed', () => {
      appStore.dispatch({ type: DISMISS_ONBOARDING });
      const el = createUnmounted();

      el.onStoreUpdate();

      expect(el.dialogActions.close).toHaveBeenCalledOnce();
      expect(el.dialogActions.open).not.toHaveBeenCalled();
    });
  });
});
