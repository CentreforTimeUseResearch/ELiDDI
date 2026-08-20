import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DetailsPanel } from './detailsPanel';
import { TinyBase } from '../base';

class TestHarness extends TinyBase {}
if (!customElements.get('test-harness-detailspanel')) {
  customElements.define('test-harness-detailspanel', TestHarness);
}

describe('DetailsPanel', () => {
  beforeEach(() => {
    if (!customElements.get('details-panel')) {
      customElements.define('details-panel', DetailsPanel);
    }
    document.body.innerHTML = '';
  });

  function createPanel() {
    // DetailsPanel expects its parent (normally Timeline) to supply
    // findNextEntryAfter/saveEntry/deleteEntry via setProps - the
    // rest-of-day "continue to..." logic reads this.props even when no
    // entry exists yet, so it must be present as soon as a start time is set
    const harness = document.createElement('test-harness-detailspanel');
    const key = harness.setProps(
      { findNextEntryAfter: () => undefined, saveEntry: vi.fn(), deleteEntry: vi.fn() },
      true
    );

    const el = document.createElement('details-panel');
    el.setAttribute('key', key);
    el.setAttribute('dimensionindex', '0');
    el.setAttribute('heading', 'Primary activity');
    el.setAttribute('instruction', 'Choose an activity');
    document.body.appendChild(el);
    return el;
  }

  it('renders its activity picker and time picker panel', () => {
    const el = createPanel();
    expect(el.querySelector('el-activitypicker')).not.toBeNull();
    expect(el.querySelector('el-time-picker-panel')).not.toBeNull();
  });

  // regression test: the save button must only activate once activity,
  // start time, AND end time are all set - it previously stayed disabled
  // when the end time came from filling in a duration rather than typing
  // an end time directly
  it('activates the save button once activity, start time, and end time are all set', () => {
    const el = createPanel();
    const saveButton = el.querySelector('.btn-save-btn');
    expect(saveButton.classList.contains('opaque')).toBe(true);

    el.setActivity('Sleep');
    expect(saveButton.classList.contains('opaque')).toBe(true);

    el.setStartTime(0);
    expect(saveButton.classList.contains('opaque')).toBe(true);

    el.setEndTime(30);
    expect(saveButton.classList.contains('opaque')).toBe(false);
  });
});
