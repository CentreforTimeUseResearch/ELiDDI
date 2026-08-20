import { describe, it, expect, beforeEach } from 'vitest';
import { DialogWidget } from './dialogWidget';

describe('DialogWidget', () => {
  beforeEach(() => {
    if (!customElements.get('el-dialog')) {
      customElements.define('el-dialog', DialogWidget);
    }
    document.body.innerHTML = '';
  });

  // regression test for the navbar "Instructions" button, which dispatches
  // RESET_ONBOARDING to reopen this dialog on demand
  it('opens on mount and toggles open/closed as onboarding is dismissed and reset', () => {
    const el = document.createElement('el-dialog');
    document.body.appendChild(el);
    const dialog = el.querySelector('dialog');

    expect(dialog.hasAttribute('open')).toBe(true);

    el.store.dispatch({ type: 'DISMISS_ONBOARDING' });
    expect(dialog.hasAttribute('open')).toBe(false);

    el.store.dispatch({ type: 'RESET_ONBOARDING' });
    expect(dialog.hasAttribute('open')).toBe(true);
  });
});
