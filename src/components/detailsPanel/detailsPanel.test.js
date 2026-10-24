import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

  // the listeners currently attached to document for `type` - counted
  // through add/removeEventListener, since the DOM can't list them
  function trackDocumentListeners(type) {
    const live = new Set();
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    vi.spyOn(document, 'addEventListener').mockImplementation(function (t, listener, options) {
      if (t === type) live.add(listener);
      return add.call(this, t, listener, options);
    });
    vi.spyOn(document, 'removeEventListener').mockImplementation(function (t, listener, options) {
      if (t === type) live.delete(listener);
      return remove.call(this, t, listener, options);
    });
    return live;
  }

  // regression coverage (#141): every open/close rebuilt the ActivityPicker,
  // and each discarded picker left its document click listener behind
  it('does not grow the document click listeners as entries are opened and closed', () => {
    const live = trackDocumentListeners('click');
    let actions;
    const harness = document.createElement('test-harness-detailspanel');
    const key = harness.setProps(
      {
        findNextEntryAfter: () => undefined,
        saveEntry: vi.fn(),
        deleteEntry: vi.fn(),
        registerPanelActions: (registered) => {
          actions = registered;
        },
      },
      true
    );
    const el = document.createElement('el-details-panel');
    el.setAttribute('key', key);
    el.setAttribute('dimensionindex', '0');
    document.body.appendChild(el);
    const mounted = live.size;

    for (let i = 0; i < 10; i++) {
      actions.openNewEntry(i * 10);
      actions.close();
    }

    expect(mounted).toBe(1);
    expect(live.size).toBe(mounted);
    vi.restoreAllMocks();
  });

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
  // regression coverage (#145): offset 0 under a midnight day boundary is
  // clock time 0, which the time panel treated as "no start time" - so the
  // start showed blank and no duration was ever computed
  describe('under a 00:00 day boundary', () => {
    let originalDayBoundary;
    beforeEach(() => {
      originalDayBoundary = GLOBALS.DATA.day_boundary;
      GLOBALS.DATA.day_boundary = '00:00';
    });
    afterEach(() => {
      GLOBALS.DATA.day_boundary = originalDayBoundary;
    });

    it('shows a new entry at the first minute of the day as 00:00, lasting 10 minutes', () => {
      const el = createPanel();

      el.openNewEntry(0);

      const timePanel = el.querySelector('el-time-picker-panel');
      expect(timePanel.querySelector('[input-id="startTime"]').getAttribute('value')).toBe('00:00');
      expect(timePanel.querySelector('[input-id="endTime"]').getAttribute('value')).toBe('00:10');
      expect(timePanel.durationInputMinutes).toBe(10);
    });
  });

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

  // regression coverage: a rapid double-click/double-activation of Save
  // must not call saveEntry twice for one submission. The real
  // Timeline.saveEntry() calls back into reset() synchronously (via
  // panelActions.close()) before returning - this mock replicates that one
  // real side effect to prove the second click (already queued on the same
  // button, same as a real double-click) sees emptied state and bails via
  // isEntryComplete(), rather than actually relying on two real browser
  // click events never overlapping.
  it('does not call saveEntry a second time from a rapid double-click on Save', () => {
    const el = createPanel();
    el.setActivity('Sleep');
    el.setStartTime(0);
    el.setEndTime(30);

    const saveEntry = vi.fn(() => el.reset());
    el.props.saveEntry = saveEntry;

    const saveButton = el.querySelector('.btn-save-btn');
    saveButton.click();
    saveButton.click(); // simulates a rapid second click on the same button

    expect(saveEntry).toHaveBeenCalledOnce();
  });
});
