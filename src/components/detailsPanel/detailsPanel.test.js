import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DetailsPanel } from './detailsPanel';
import { TinyBase } from '../base';

class TestHarness extends TinyBase {}
if (!customElements.get('test-harness-detailspanel')) {
  customElements.define('test-harness-detailspanel', TestHarness);
}

describe('DetailsPanel', () => {
  beforeEach(() => {
    if (!customElements.get('el-details-panel')) {
      customElements.define('el-details-panel', DetailsPanel);
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

    const el = document.createElement('el-details-panel');
    el.setAttribute('key', key);
    el.setAttribute('dimensionindex', '0');
    el.setAttribute('heading', 'Primary activity');
    el.setAttribute('instruction', 'Choose an activity');
    document.body.appendChild(el);
    return el;
  }

  it('renders its activity picker and time picker panel', () => {
    const el = createPanel();
    expect(el.querySelector('el-activity-picker')).not.toBeNull();
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

  // regression coverage for defaulting a new entry to a 10-minute span, so
  // it has an immediately-visible, drag-resizable block on the timeline
  // instead of a zero-length one the respondent has to fix by hand first
  it("defaults a new entry's end time to ten minutes after its start time", () => {
    const el = createPanel();

    el.openNewEntry(60);

    expect(el.state.startOffsetMins).toBe(60);
    expect(el.state.endOffsetMins).toBe(70);
  });

  it('activates the save button as soon as an activity is set for a new entry, since both times are already filled in', () => {
    const el = createPanel();

    // openNewEntry() calls reset() internally, which fully re-renders the
    // panel (a fresh save button included) - so the button must be looked
    // up after this call, not before
    el.openNewEntry(60);
    const saveButton = el.querySelector('.btn-save-btn');
    expect(saveButton.classList.contains('opaque')).toBe(true);

    el.setActivity('Sleep');
    expect(saveButton.classList.contains('opaque')).toBe(false);
  });

  it("passes the ten-minute-later end time through to the time picker panel's end-time attribute", () => {
    const el = createPanel();

    el.openNewEntry(60);

    const startTime = Number(el.timelinePickerPanel.getAttribute('start-time'));
    const endTime = Number(el.timelinePickerPanel.getAttribute('end-time'));
    expect(endTime - startTime).toBe(10);
  });
});
