import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TinyBase } from './base';
import { countProps } from './propsRegistry';

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

// Props ownership (#140): the component that allocates a key with setProps
// owns it, and releases it when it renders again or disconnects. A child
// never deletes the key it was given.
describe('TinyBase props ownership', () => {
  class PanelHost extends TinyBase {
    saved = [];
    render() {
      this.innerHTML = `<el-details-panel ${this.setProps({
        saveEntry: (entry) => this.saved.push(entry),
        deleteEntry: () => {},
        findNextEntryAfter: () => undefined,
        registerPanelActions: () => {},
      })} dimensionindex="0" heading="h" instruction="i"></el-details-panel>`;
    }
  }
  // builds markup for a child it hands on as a string - like
  // DynamicTimelineUI's onboarding content - which may never be mounted
  class UnmountedMarkupHost extends TinyBase {
    render() {
      this.pendingMarkup = `<el-onboarding ${this.setProps({ moveSpotlight: () => {} })}></el-onboarding>`;
    }
  }
  if (!customElements.get('panel-host')) {
    customElements.define('panel-host', PanelHost);
    customElements.define('unmounted-markup-host', UnmountedMarkupHost);
  }

  beforeEach(async () => {
    await import('./detailsPanel/detailsPanel');
    document.body.innerHTML = '';
  });

  it('returns the registry to its starting size after a component tree is mounted and unmounted repeatedly', () => {
    const before = countProps();

    for (let i = 0; i < 5; i++) {
      const host = document.createElement('panel-host');
      document.body.appendChild(host);
      // re-rendering while mounted rebuilds the picker subtrees, allocating new keys
      host.querySelector('el-details-panel').reset();
      const picker = host.querySelector('el-activity-picker');
      picker.input.value = 's';
      picker.updateResults();
      host.remove();
    }

    expect(countProps()).toBe(before);
  });

  it('does not grow the registry when a mounted component re-renders', () => {
    const host = document.createElement('panel-host');
    document.body.appendChild(host);
    const panel = host.querySelector('el-details-panel');
    const picker = () => host.querySelector('el-activity-picker');
    const mounted = countProps();

    for (let i = 0; i < 5; i++) {
      panel.reset();
      picker().input.value = i % 2 ? 'sl' : 's';
      picker().updateResults();
    }

    expect(countProps()).toBe(mounted);
  });

  // regression coverage (#140): keys were only ever deleted by the child
  // that consumed them, so markup built but never mounted leaked its entry
  it('releases keys for markup that was built but never mounted', () => {
    const before = countProps();

    for (let i = 0; i < 5; i++) {
      const host = document.createElement('unmounted-markup-host');
      document.body.appendChild(host);
      host.render();
      host.remove();
    }

    expect(countProps()).toBe(before);
  });

  // regression coverage (#140): moving an element runs disconnectedCallback
  // (which deleted its props) then connectedCallback (which re-read the
  // deleted key), leaving this.props undefined
  it('keeps a child component working after it is moved in the DOM', () => {
    const host = document.createElement('panel-host');
    document.body.appendChild(host);
    const panel = host.querySelector('el-details-panel');

    const elsewhere = document.createElement('div');
    host.appendChild(elsewhere);
    elsewhere.appendChild(panel);

    expect(panel.props).toBeDefined();
    panel.props.saveEntry('entry');
    expect(host.saved).toEqual(['entry']);
  });

  it('re-renders a moved owner without leaking its old keys', () => {
    const before = countProps();
    const host = document.createElement('panel-host');
    document.body.appendChild(host);
    const mounted = countProps();

    const elsewhere = document.createElement('div');
    document.body.appendChild(elsewhere);
    elsewhere.appendChild(host);

    expect(countProps()).toBe(mounted);
    host.querySelector('el-details-panel').props.saveEntry('entry');
    expect(host.saved).toEqual(['entry']);

    host.remove();
    expect(countProps()).toBe(before);
  });
});
