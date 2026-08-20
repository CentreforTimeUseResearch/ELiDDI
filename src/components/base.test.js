import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TinyBase } from './base';

class RegisterCleanupHarness extends TinyBase {}
if (!customElements.get('register-cleanup-harness')) {
  customElements.define('register-cleanup-harness', RegisterCleanupHarness);
}

describe('TinyBase.registerCleanup', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // regression test: components used to hand-roll their own
  // disconnectedCallback (or skip it entirely) to clear timers/listeners/
  // store subscriptions, and most forgot to - registerCleanup lets any
  // TinyBase subclass register teardown without overriding the lifecycle
  // method itself
  it('invokes every registered cleanup function once on disconnect, and only once', () => {
    const el = document.createElement('register-cleanup-harness');
    document.body.appendChild(el);

    const cleanupA = vi.fn();
    const cleanupB = vi.fn();
    el.registerCleanup(cleanupA);
    el.registerCleanup(cleanupB);

    el.remove();

    expect(cleanupA).toHaveBeenCalledTimes(1);
    expect(cleanupB).toHaveBeenCalledTimes(1);

    // a second disconnect (e.g. removing an already-detached node) must not
    // re-run stale cleanup
    document.body.appendChild(el);
    el.remove();
    expect(cleanupA).toHaveBeenCalledTimes(1);
    expect(cleanupB).toHaveBeenCalledTimes(1);
  });
});
