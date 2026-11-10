import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DetailsPanel } from './detailsPanel';
import { TinyBase } from '../base';
import { appStore } from '../../store/appStore';
import { SHOW_PANEL, HIDE_PANEL } from '../../store/actionTypes';

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

  // #232: what the panel was opened with, so it knows when something is unsaved
  describe('unsaved edits', () => {
    const START = 60;
    const END = 90;
    // clock minutes of an offset, as the time picker reports them (day boundary 04:00)
    const clock = (offsetMins) => offsetMins + 4 * 60;

    function mountPanel({ dimensionIndex = 0 } = {}) {
      const harness = document.createElement('test-harness-detailspanel');
      const saveEntry = vi.fn();
      const key = harness.setProps(
        { findNextEntryAfter: () => undefined, saveEntry, deleteEntry: vi.fn() },
        true
      );
      const el = document.createElement('el-details-panel');
      el.setAttribute('key', key);
      el.setAttribute('dimensionindex', String(dimensionIndex));
      el.setAttribute('heading', 'Heading');
      el.setAttribute('instruction', 'Instruction');
      document.body.appendChild(el);
      return { el, saveEntry };
    }

    it('is not unsaved when nothing has been opened', () => {
      const { el } = mountPanel();

      expect(el.hasUnsavedEdits()).toBe(false);
    });

    it('is not unsaved straight after opening an Entry', () => {
      const { el } = mountPanel();

      el.openEntry({ id: 3, startOffsetMins: START, endOffsetMins: END, activity: 'sleeping' });

      expect(el.hasUnsavedEdits()).toBe(false);
    });

    it('is not unsaved straight after opening a new block, even one dragged out with times already', () => {
      const { el } = mountPanel();

      el.openNewEntry(START, END);

      expect(el.hasUnsavedEdits()).toBe(false);
    });

    it('is unsaved once the start, the end or the activity has changed', () => {
      const { el } = mountPanel();
      const open = () =>
        el.openEntry({ id: 3, startOffsetMins: START, endOffsetMins: END, activity: 'sleeping' });

      open();
      el.setEndTime(100);
      expect(el.hasUnsavedEdits()).toBe(true);

      open();
      el.setStartTime(70);
      expect(el.hasUnsavedEdits()).toBe(true);

      open();
      el.setActivity('resting');
      expect(el.hasUnsavedEdits()).toBe(true);
    });

    it('is unsaved once a new block has been given an activity', () => {
      const { el } = mountPanel();
      el.openNewEntry(START, END);

      el.onSetActivityOnSelectedEntry('sleeping');

      expect(el.hasUnsavedEdits()).toBe(true);
    });

    it('is not unsaved again when a change is changed back', () => {
      const { el } = mountPanel();
      el.openEntry({ id: 3, startOffsetMins: START, endOffsetMins: END, activity: 'sleeping' });

      el.setEndTime(100);
      el.setEndTime(END);

      expect(el.hasUnsavedEdits()).toBe(false);
    });

    it('is not unsaved when a time is set to the one it already has, through the time picker', () => {
      const { el } = mountPanel();
      el.openEntry({ id: 3, startOffsetMins: START, endOffsetMins: END, activity: 'sleeping' });

      el.onSetOffsetMins({ timeField: 'endTime', timeInMinutes: clock(END) });
      el.onSetOffsetMins({ timeField: 'startTime', timeInMinutes: clock(START) });

      expect(el.hasUnsavedEdits()).toBe(false);
    });

    it('does not mind the order of several chosen activities (a multiple-choice Dimension)', () => {
      const { el } = mountPanel({ dimensionIndex: 3 });
      el.openEntry({
        id: 3,
        startOffsetMins: START,
        endOffsetMins: END,
        activity: ['alone', 'with friends'],
      });

      el.onSetActivitiesOnSelectedEntry(['with friends', 'alone']);
      expect(el.hasUnsavedEdits()).toBe(false);

      el.onSetActivitiesOnSelectedEntry(['alone', 'with friends', 'with family']);
      expect(el.hasUnsavedEdits()).toBe(true);

      el.onSetActivitiesOnSelectedEntry(['alone']);
      expect(el.hasUnsavedEdits()).toBe(true);
    });

    it('treats no activity, an empty one and an empty list as the same thing', () => {
      const { el } = mountPanel();
      el.openNewEntry(START, END);

      el.onSetActivityOnSelectedEntry('');
      expect(el.hasUnsavedEdits()).toBe(false);
      el.onSetActivitiesOnSelectedEntry([]);
      expect(el.hasUnsavedEdits()).toBe(false);
    });

    it('is not unsaved once the panel has been reset, whatever was in it', () => {
      const { el } = mountPanel();
      el.openEntry({ id: 3, startOffsetMins: START, endOffsetMins: END, activity: 'sleeping' });
      el.setEndTime(100);

      el.reset();

      expect(el.hasUnsavedEdits()).toBe(false);
    });

    it('is a fresh start each time something is opened', () => {
      const { el } = mountPanel();
      el.openEntry({ id: 3, startOffsetMins: START, endOffsetMins: END, activity: 'sleeping' });
      el.setEndTime(100);

      el.openEntry({ id: 4, startOffsetMins: 120, endOffsetMins: 150, activity: 'resting' });

      expect(el.hasUnsavedEdits()).toBe(false);
    });

    it('is offered to a Timeline through the panel actions', () => {
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
      actions.openEntry({
        id: 3,
        startOffsetMins: START,
        endOffsetMins: END,
        activity: 'sleeping',
      });
      expect(actions.hasUnsavedEdits()).toBe(false);

      el.setEndTime(100);

      expect(actions.hasUnsavedEdits()).toBe(true);
    });

    it('can be parked and restored, with what it was opened with', () => {
      const { el } = mountPanel();
      el.openEntry({ id: 3, startOffsetMins: START, endOffsetMins: END, activity: 'sleeping' });
      el.setEndTime(100);

      const draft = el.getDraft();
      el.reset();
      expect(el.hasUnsavedEdits()).toBe(false);
      el.restoreDraft(draft);

      expect(el.state).toMatchObject({ startOffsetMins: START, endOffsetMins: 100 });
      expect(el.hasUnsavedEdits()).toBe(true);
    });

    it('restores a clean draft as clean', () => {
      const { el } = mountPanel();
      el.openEntry({ id: 3, startOffsetMins: START, endOffsetMins: END, activity: 'sleeping' });

      const draft = el.getDraft();
      el.reset();
      el.restoreDraft(draft);

      expect(el.hasUnsavedEdits()).toBe(false);
    });

    it('has no draft to park when nothing is open', () => {
      const { el } = mountPanel();

      expect(el.getDraft()).toBeUndefined();
    });
  });

  // #232: Save says why it is off, instead of only fading
  describe('Save when the entry is not complete', () => {
    function mountPanel() {
      const harness = document.createElement('test-harness-detailspanel');
      const saveEntry = vi.fn();
      const key = harness.setProps(
        { findNextEntryAfter: () => undefined, saveEntry, deleteEntry: vi.fn() },
        true
      );
      const el = document.createElement('el-details-panel');
      el.setAttribute('key', key);
      el.setAttribute('dimensionindex', '0');
      el.setAttribute('heading', 'Heading');
      el.setAttribute('instruction', 'Instruction');
      document.body.appendChild(el);
      return { el, saveEntry };
    }
    const save = (el) => el.querySelector('.btn-save-btn');
    const hint = (el) => el.querySelector('.save-hint');
    const hintText = (el) => hint(el).textContent.trim();

    beforeEach(() => {
      HTMLElement.prototype.showPopover = vi.fn(); // jsdom has no Popover API
    });

    afterEach(() => {
      delete HTMLElement.prototype.showPopover;
    });

    it('is aria-disabled, and still an ordinary focusable button', () => {
      const { el } = mountPanel();
      el.openNewEntry(60, 90); // no activity yet

      expect(save(el).getAttribute('aria-disabled')).toBe('true');
      expect(save(el).disabled).toBe(false);
      expect(save(el).tabIndex).toBe(0);
    });

    it('says what is missing, as text, tied to the button', () => {
      const { el } = mountPanel();
      el.openNewEntry(60, 90);

      expect(hintText(el)).toBe('Choose an activity');
      const describedBy = save(el).getAttribute('aria-describedby').split(' ');
      expect(describedBy).toContain(hint(el).id);
      expect(el.querySelector(`#${hint(el).id}`)).toBe(hint(el));
      expect(hint(el).hasAttribute('hidden')).toBe(false);
    });

    it('says an entry must be long enough', () => {
      const { el } = mountPanel();
      el.openNewEntry(60, 90);
      el.onSetActivityOnSelectedEntry('sleeping');

      el.setEndTime(60);

      expect(hintText(el)).toBe('An entry must last at least 10 minutes');
      expect(save(el).getAttribute('aria-disabled')).toBe('true');
    });

    it('says everything that is missing', () => {
      const { el } = mountPanel();
      el.openNewEntry(60, 90);

      el.setEndTime(60);

      expect(hintText(el)).toBe('Choose an activity. An entry must last at least 10 minutes');
    });

    it('is quiet, and enabled, once the entry is complete', () => {
      const { el } = mountPanel();
      el.openNewEntry(60, 90);

      el.onSetActivityOnSelectedEntry('sleeping');

      expect(save(el).hasAttribute('aria-disabled')).toBe(false);
      expect(hintText(el)).toBe('');
      expect(hint(el).hasAttribute('hidden')).toBe(true);
      expect(save(el).getAttribute('aria-describedby') ?? '').not.toContain(hint(el).id);
    });

    it('says why again if the entry becomes incomplete again', () => {
      const { el } = mountPanel();
      el.openNewEntry(60, 90);
      el.onSetActivityOnSelectedEntry('sleeping');

      el.onSetActivityOnSelectedEntry('');

      expect(save(el).getAttribute('aria-disabled')).toBe('true');
      expect(hintText(el)).toBe('Choose an activity');
    });

    it('does not save when pressed, and takes focus to what needs choosing', () => {
      const { el, saveEntry } = mountPanel();
      el.openNewEntry(60, 90);

      save(el).click();

      expect(saveEntry).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(el.querySelector('[role="combobox"]'));
    });

    it('takes focus to the end time when it is the time that is wrong', () => {
      const { el, saveEntry } = mountPanel();
      el.openNewEntry(60, 90);
      el.onSetActivityOnSelectedEntry('sleeping');
      el.setEndTime(60);

      save(el).click();

      expect(saveEntry).not.toHaveBeenCalled();
      expect(document.activeElement.closest('el-time-picker')?.getAttribute('input-id')).toBe(
        'endTime'
      );
    });

    it('saves as before once complete', () => {
      const { el, saveEntry } = mountPanel();
      el.openNewEntry(60, 90);
      el.onSetActivityOnSelectedEntry('sleeping');

      save(el).click();

      expect(saveEntry).toHaveBeenCalledOnce();
    });

    it('keeps the panel message area, for save conflicts, tied to Save while it says something', () => {
      const { el } = mountPanel();
      el.openNewEntry(60, 90);
      el.onSetActivityOnSelectedEntry('sleeping');
      const error = el.querySelector('.entry-error');
      expect(error.id).not.toBe('');
      expect(save(el).getAttribute('aria-describedby') ?? '').not.toContain(error.id);

      el.showError('This overlaps with your existing "Home" entry');
      expect(save(el).getAttribute('aria-describedby').split(' ')).toContain(error.id);

      el.clearError();
      expect(save(el).getAttribute('aria-describedby') ?? '').not.toContain(error.id);
    });

    // one after the other: the activity list's own popover has a fixed id, so
    // two panels in a page at once are not something the app (or a test) can do
    it('does not give the hint or the message the same id as another panel', () => {
      const first = mountPanel().el;
      const firstIds = [hint(first).id, first.querySelector('.entry-error').id];
      first.remove();

      const second = mountPanel().el;

      expect(hint(second).id).not.toBe(firstIds[0]);
      expect(second.querySelector('.entry-error').id).not.toBe(firstIds[1]);
    });
  });

  // #232: the field-level wiring is already right; this keeps it that way
  describe('validation messages stay tied to their fields', () => {
    it('points every time and duration field at a hint and an error that exist', () => {
      const harness = document.createElement('test-harness-detailspanel');
      const key = harness.setProps(
        { findNextEntryAfter: () => undefined, saveEntry: vi.fn(), deleteEntry: vi.fn() },
        true
      );
      const el = document.createElement('el-details-panel');
      el.setAttribute('key', key);
      el.setAttribute('dimensionindex', '0');
      document.body.appendChild(el);
      el.openNewEntry(60, 90);

      const fields = [...el.querySelectorAll('el-time-picker input, el-duration-input input')];
      expect(fields.length).toBeGreaterThanOrEqual(4); // start, end, hours, minutes
      fields.forEach((field) => {
        const tokens = field.getAttribute('aria-describedby').split(' ');
        expect(tokens.length).toBe(2);
        tokens.forEach((token) => expect(el.querySelector(`#${token}`)).not.toBeNull());
      });
      el.querySelectorAll('.error-text').forEach((error) =>
        expect(error.getAttribute('aria-live')).toBe('polite')
      );
    });
  });

  describe('keyboard', () => {
    const escape = (target) =>
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    beforeEach(() => {
      appStore.dispatch({ type: HIDE_PANEL });
      // jsdom has no Popover API; focusing the activity field opens the list
      HTMLElement.prototype.showPopover = vi.fn();
    });

    afterEach(() => {
      appStore.dispatch({ type: HIDE_PANEL });
      delete HTMLElement.prototype.showPopover;
    });

    it('closes on Escape, like its close button', () => {
      const el = createPanel();
      appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });
      expect(el.open).toBe(true);

      escape(el.querySelector('input'));

      expect(appStore.getState().uipanel).not.toBe('details');
      expect(el.open).toBe(false);
    });

    describe('with the activity list open', () => {
      // jsdom has no Popover API, so the list is reported open by stubbing,
      // and closes when asked to
      function openList(el) {
        const popover = el.querySelector('[popover]');
        let open = true;
        vi.spyOn(popover, 'matches').mockImplementation(
          (selector) => selector === ':popover-open' && open
        );
        popover.hidePopover = vi.fn(() => {
          open = false;
        });
        return popover;
      }

      it('closes the list, not the panel, on the first Escape', () => {
        const el = createPanel();
        appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });
        const popover = openList(el);

        escape(el.querySelector('[role="combobox"]'));

        expect(popover.hidePopover).toHaveBeenCalled();
        expect(appStore.getState().uipanel).toBe('details');
        expect(el.open).toBe(true);
      });

      it('closes the panel on the next Escape', () => {
        const el = createPanel();
        appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });
        openList(el);

        escape(el.querySelector('[role="combobox"]'));
        escape(el.querySelector('[role="combobox"]'));

        expect(appStore.getState().uipanel).not.toBe('details');
      });

      it('leaves a list that closed itself alone, and still keeps the panel', () => {
        const el = createPanel();
        appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });
        const popover = openList(el);
        // the list's own Escape handling (typed search) closes it first
        el.querySelector('[role="combobox"]').addEventListener('keydown', () => {
          popover.hidePopover();
          popover.hidePopover.mockClear();
        });

        escape(el.querySelector('[role="combobox"]'));

        expect(popover.hidePopover).not.toHaveBeenCalled();
        expect(appStore.getState().uipanel).toBe('details');
      });
    });

    it('ignores Escape when it is not open, and other keys when it is', () => {
      const el = createPanel();
      const dispatch = vi.spyOn(appStore, 'dispatch');

      escape(el);
      expect(dispatch).not.toHaveBeenCalled();

      appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });
      dispatch.mockClear();
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('takes focus into the activity field when asked', () => {
      const el = createPanel();

      el.focusActivity();

      expect(document.activeElement).toBe(el.querySelector('[role="combobox"]'));
    });

    it('offers that to a Timeline as a panel action', () => {
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

      actions.focus();

      expect(document.activeElement).toBe(el.querySelector('[role="combobox"]'));
    });
  });

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

  // regression coverage (#146): heading/instruction attribute values were
  // re-interpolated into the picker's markup unescaped
  it('passes a heading and instruction containing quotes and brackets to its picker intact', () => {
    const heading = `Who's "with" you <now>`;
    const instruction = `Pick <one> & move on`;
    const el = createPanel();
    el.setAttribute('heading', heading);
    el.setAttribute('instruction', instruction);

    el.reset();

    const picker = el.querySelector('el-activity-picker');
    expect(picker.getAttribute('heading')).toBe(heading);
    expect(picker.getAttribute('instruction')).toBe(instruction);
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

  // #162: an Entry lasts at least 10 minutes, so Save stays disabled for
  // anything shorter
  describe('the 10-minute minimum', () => {
    const saveEnabled = (el) => !el.querySelector('.btn-save-btn').classList.contains('opaque');

    it.each([
      [0, false],
      [5, false],
      [9, false],
      [10, true],
    ])('enables Save for a %i-minute Entry: %s', (minutes, enabled) => {
      const el = createPanel();
      el.setActivity('Sleep');
      el.setStartTime(60);
      el.setEndTime(60 + minutes);

      expect(saveEnabled(el)).toBe(enabled);
    });

    it('opens a new Entry with the given start and end times, or one slot long without an end', () => {
      const el = createPanel();

      el.openNewEntry(60, 90);
      expect(el.state.startOffsetMins).toBe(60);
      expect(el.state.endOffsetMins).toBe(90);

      el.openNewEntry(120);
      expect(el.state.startOffsetMins).toBe(120);
      expect(el.state.endOffsetMins).toBe(130);
    });

    // found checking #162 in a real browser: Save was only ever enabled,
    // never disabled again, so shortening a valid Entry left it looking
    // clickable
    it('disables Save again when a valid Entry is shortened below 10 minutes', () => {
      const el = createPanel();
      el.openNewEntry(60); // ends 10 minutes later: valid
      el.setActivity('Sleep');
      expect(saveEnabled(el)).toBe(true);

      el.setEndTime(60);

      expect(saveEnabled(el)).toBe(false);
    });

    // regression coverage (#162): the offset of an end time typed past
    // midnight was clock - day boundary, i.e. negative (01:00 under a 04:00
    // boundary was -180), so the Entry ended before it started. Times
    // earlier than the day boundary belong to the end of the diary day
    it('stores an end time typed past midnight later in the same diary day', () => {
      const el = createPanel();
      el.openNewEntry(1140); // 23:00
      el.setActivity('Sleep');

      el.querySelector('el-time-picker-panel').onTimeInputChange('endTime', 60); // typed 01:00

      expect(el.state.endOffsetMins).toBe(1260); // 01:00 is 21 hours after 04:00
      expect(saveEnabled(el)).toBe(true);
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
