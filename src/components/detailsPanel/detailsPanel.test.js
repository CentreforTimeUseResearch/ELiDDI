import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DetailsPanel } from './detailsPanel';
import { TinyBase } from '../base';
import { appStore } from '../../store/appStore';
import { SHOW_PANEL, HIDE_PANEL } from '../../store/actionTypes';
import { registerUnsavedEditsGuard } from '../../utils/unsavedEdits';

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

  // #242: asking before something unsaved is lost
  describe('leaving with unsaved edits', () => {
    const ENTRY = { id: 7, startOffsetMins: 60, endOffsetMins: 90, activity: 'sleeping' };
    let el;
    let saveEntry;

    function mountPanel() {
      const harness = document.createElement('test-harness-detailspanel');
      saveEntry = vi.fn(() => el.reset()); // what a successful save does: the Timeline closes the panel
      const key = harness.setProps(
        { findNextEntryAfter: () => undefined, saveEntry, deleteEntry: vi.fn() },
        true
      );
      el = document.createElement('el-details-panel');
      el.setAttribute('key', key);
      el.setAttribute('dimensionindex', '0');
      el.setAttribute('heading', 'Heading');
      el.setAttribute('instruction', 'Instruction');
      document.body.appendChild(el);
      appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });
      return el;
    }
    const prompt = () => el.querySelector('.leave-prompt');
    const asking = () => !prompt().hasAttribute('hidden');
    const saveButton = () => el.querySelector('.btn-leave-save');
    const discardButton = () => el.querySelector('.btn-leave-discard');
    const keepButton = () => el.querySelector('.btn-leave-keep');
    const visible = (button) => !button.hasAttribute('hidden') && !button.closest('[hidden]');
    const callbacks = () => ({ onSave: vi.fn(), onDiscard: vi.fn(), onKeep: vi.fn() });
    const editedEntry = () => {
      mountPanel();
      el.openEntry(ENTRY);
      el.setEndTime(100);
    };

    beforeEach(() => {
      HTMLElement.prototype.showPopover = vi.fn(); // jsdom has no Popover API
      appStore.dispatch({ type: HIDE_PANEL });
    });

    afterEach(() => {
      delete HTMLElement.prototype.showPopover;
      appStore.dispatch({ type: HIDE_PANEL });
    });

    describe('the prompt', () => {
      it('is not showing until it is asked for', () => {
        mountPanel();

        expect(asking()).toBe(false);
      });

      it('says there are unsaved changes, in a labelled group, not a browser dialog', () => {
        editedEntry();
        const confirm = vi.spyOn(window, 'confirm');

        el.showLeavePrompt(callbacks());

        expect(asking()).toBe(true);
        expect(prompt().textContent).toContain('You have unsaved changes to this entry.');
        expect(prompt().getAttribute('role')).toBe('group');
        expect(
          el.querySelector(`#${prompt().getAttribute('aria-labelledby')}`).textContent
        ).toContain('unsaved changes');
        expect(confirm).not.toHaveBeenCalled();
        expect(document.querySelector('dialog[open]')).toBeNull();
      });

      it('offers Save, Discard and Keep editing when the entry is complete', () => {
        editedEntry();

        el.showLeavePrompt(callbacks());

        expect(visible(saveButton())).toBe(true);
        expect(visible(discardButton())).toBe(true);
        expect(visible(keepButton())).toBe(true);
      });

      it('does not offer Save for an incomplete entry, and says why in text', () => {
        editedEntry();
        el.onSetActivityOnSelectedEntry('');

        el.showLeavePrompt(callbacks());

        expect(visible(saveButton())).toBe(false);
        expect(visible(discardButton())).toBe(true);
        expect(visible(keepButton())).toBe(true);
        expect(prompt().textContent).toContain("can't be saved yet");
        expect(prompt().textContent).toContain('Choose an activity');
      });

      it('gives focus to Keep editing, the safe choice, which is described by the question', () => {
        editedEntry();

        el.showLeavePrompt(callbacks());

        expect(document.activeElement).toBe(keepButton());
        expect(
          el.querySelector(`#${keepButton().getAttribute('aria-describedby')}`).textContent
        ).toContain('unsaved changes');
      });

      it('puts Save, Delete and the Save hint out of the way while it asks', () => {
        editedEntry();

        el.showLeavePrompt(callbacks());

        expect(el.hasAttribute('data-leaving')).toBe(true);
      });

      it('replaces a Delete question that was showing', () => {
        editedEntry();
        el.querySelector('.btn-delete-btn').click();
        expect(el.hasAttribute('data-confirming-delete')).toBe(true);

        el.showLeavePrompt(callbacks());

        expect(el.hasAttribute('data-confirming-delete')).toBe(false);
        expect(asking()).toBe(true);
      });
    });

    describe('answering it', () => {
      it('Save takes the prompt away and does what it was given', () => {
        editedEntry();
        const given = callbacks();
        el.showLeavePrompt(given);

        saveButton().click();

        expect(asking()).toBe(false);
        expect(given.onSave).toHaveBeenCalledOnce();
        expect(given.onDiscard).not.toHaveBeenCalled();
        expect(given.onKeep).not.toHaveBeenCalled();
      });

      it('Discard takes the prompt away and does what it was given', () => {
        editedEntry();
        const given = callbacks();
        el.showLeavePrompt(given);

        discardButton().click();

        expect(asking()).toBe(false);
        expect(given.onDiscard).toHaveBeenCalledOnce();
        expect(given.onSave).not.toHaveBeenCalled();
      });

      it('Keep editing takes the prompt away, leaves the draft, and gives focus back to where it was', () => {
        editedEntry();
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();
        const given = callbacks();
        el.showLeavePrompt(given);

        keepButton().click();

        expect(asking()).toBe(false);
        expect(given.onKeep).toHaveBeenCalledOnce();
        expect(el.hasUnsavedEdits()).toBe(true);
        expect(el.state.endOffsetMins).toBe(100);
        expect(document.activeElement).toBe(opener);
      });

      it('Keep editing goes to the activity field if where it was is gone', () => {
        editedEntry();
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();
        el.showLeavePrompt(callbacks());
        opener.remove();

        keepButton().click();

        expect(document.activeElement).toBe(el.querySelector('[role="combobox"]'));
      });

      it('Escape is Keep editing, and does not also close the panel', () => {
        editedEntry();
        const given = callbacks();
        el.showLeavePrompt(given);

        const escape = new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        });
        keepButton().dispatchEvent(escape);

        expect(escape.defaultPrevented).toBe(true);
        expect(given.onKeep).toHaveBeenCalledOnce();
        expect(asking()).toBe(false);
        expect(appStore.getState().uipanel).toBe('details');
      });

      it('answers once: a second press does nothing more', () => {
        editedEntry();
        const given = callbacks();
        el.showLeavePrompt(given);

        discardButton().click();
        discardButton().click();

        expect(given.onDiscard).toHaveBeenCalledOnce();
      });
    });

    describe('when it is dropped without an answer', () => {
      it('goes when the panel is reset, and nothing is called', () => {
        editedEntry();
        const given = callbacks();
        el.showLeavePrompt(given);

        el.reset();

        expect(asking()).toBe(false);
        expect(el.hasAttribute('data-leaving')).toBe(false);
        expect(given.onKeep).not.toHaveBeenCalled();
        expect(given.onDiscard).not.toHaveBeenCalled();
      });

      it('goes when the panel is hidden, and does not come back with it', () => {
        editedEntry();
        el.showLeavePrompt(callbacks());

        appStore.dispatch({ type: HIDE_PANEL });
        appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });

        expect(asking()).toBe(false);
      });
    });

    describe('saving from the prompt', () => {
      it('does not save an incomplete entry', () => {
        editedEntry();
        el.onSetActivityOnSelectedEntry('');

        expect(el.saveDraft()).toBe(false);
        expect(saveEntry).not.toHaveBeenCalled();
      });

      it('saves a complete one, and says it worked when the panel has been closed by the save', () => {
        editedEntry();

        expect(el.saveDraft()).toBe(true);
        expect(saveEntry).toHaveBeenCalledWith(
          expect.objectContaining({ id: 7, endOffsetMins: 100 })
        );
      });

      it('says it did not work when the save was refused, with the reason left showing', () => {
        editedEntry();
        saveEntry.mockImplementation(() =>
          el.showError('This overlaps with your existing "Home" entry')
        );

        expect(el.saveDraft()).toBe(false);
        expect(el.querySelector('.entry-error').hasAttribute('hidden')).toBe(false);
        expect(el.state.endOffsetMins).toBe(100); // nothing lost
      });
    });

    describe('closing the panel (Escape, the chevron)', () => {
      const escape = (target) =>
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const chevron = () => el.querySelector('[data-openCloseButton]');

      it('asks the guard, as a close, rather than just hiding', () => {
        editedEntry();
        const guard = vi.fn();
        const unregister = registerUnsavedEditsGuard(guard);

        escape(el.querySelector('[role="combobox"]'));
        chevron().click();

        expect(guard).toHaveBeenCalledTimes(2);
        expect(guard).toHaveBeenCalledWith({}, expect.any(Function), undefined);
        expect(appStore.getState().uipanel).toBe('details'); // not closed until it says so
        unregister();
      });

      it('hides the panel and forgets what was in it, when the guard lets it go', () => {
        editedEntry();
        const unregister = registerUnsavedEditsGuard((scope, proceed) => proceed());

        escape(el.querySelector('[role="combobox"]'));

        expect(appStore.getState().uipanel).not.toBe('details');
        expect(el.state).toEqual({});
        expect(el.hasUnsavedEdits()).toBe(false);
        unregister();
      });

      it('leaves no stale draft behind when nothing is registered and the panel was clean', () => {
        mountPanel();
        el.openEntry(ENTRY);

        escape(el.querySelector('[role="combobox"]'));
        appStore.dispatch({ type: SHOW_PANEL, payload: 'details' }); // as the chevron does

        expect(el.state).toEqual({});
      });

      it('closes by the chevron too, and opens by it when closed', () => {
        mountPanel();
        el.openEntry(ENTRY);

        chevron().click();
        expect(appStore.getState().uipanel).not.toBe('details');
        expect(el.state).toEqual({});

        chevron().click();
        expect(appStore.getState().uipanel).toBe('details');
      });
    });

    describe('what a parked draft is', () => {
      it('knows whether a parked draft is unsaved, from what it holds and was opened with', () => {
        mountPanel();
        el.openEntry(ENTRY);
        const clean = el.getDraft();
        el.setEndTime(100);
        const edited = el.getDraft();

        expect(el.isDraftUnsaved(clean)).toBe(false);
        expect(el.isDraftUnsaved(edited)).toBe(true);
        expect(el.isDraftUnsaved(undefined)).toBe(false);
      });
    });
  });

  // #243: Delete asks first, inside the panel
  describe('Delete confirmation', () => {
    const ENTRY = { id: 7, startOffsetMins: 60, endOffsetMins: 90, activity: 'sleeping' };

    function mountPanel() {
      const harness = document.createElement('test-harness-detailspanel');
      const deleteEntry = vi.fn();
      const key = harness.setProps(
        { findNextEntryAfter: () => undefined, saveEntry: vi.fn(), deleteEntry },
        true
      );
      const el = document.createElement('el-details-panel');
      el.setAttribute('key', key);
      el.setAttribute('dimensionindex', '0');
      el.setAttribute('heading', 'Heading');
      el.setAttribute('instruction', 'Instruction');
      document.body.appendChild(el);
      appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });
      return { el, deleteEntry };
    }
    const deleteButton = (el) => el.querySelector('.btn-delete-btn');
    const group = (el) => el.querySelector('.delete-confirm');
    const confirmButton = (el) => el.querySelector('.btn-confirm-delete-btn');
    const keepButton = (el) => el.querySelector('.btn-keep-btn');
    const isAsking = (el) => !group(el).hasAttribute('hidden');
    const visible = (button) => !button.closest('[hidden]') && !button.classList.contains('hide');

    beforeEach(() => {
      HTMLElement.prototype.showPopover = vi.fn(); // jsdom has no Popover API
      appStore.dispatch({ type: HIDE_PANEL });
    });

    afterEach(() => {
      delete HTMLElement.prototype.showPopover;
      appStore.dispatch({ type: HIDE_PANEL });
    });

    it('is not asking, and does not show its question, until Delete is pressed', () => {
      const { el } = mountPanel();
      el.openEntry(ENTRY);

      expect(isAsking(el)).toBe(false);
    });

    it('asks, instead of deleting, when Delete is pressed', () => {
      const { el, deleteEntry } = mountPanel();
      el.openEntry(ENTRY);

      deleteButton(el).click();

      expect(deleteEntry).not.toHaveBeenCalled();
      expect(isAsking(el)).toBe(true);
      expect(group(el).textContent).toContain("Delete this entry? This can't be undone.");
    });

    it('is a labelled group, not a browser dialog, and never uses window.confirm', () => {
      const confirm = vi.spyOn(window, 'confirm');
      const { el } = mountPanel();
      el.openEntry(ENTRY);

      deleteButton(el).click();

      expect(group(el).getAttribute('role')).toBe('group');
      const label = el.querySelector(`#${group(el).getAttribute('aria-labelledby')}`);
      expect(label.textContent).toContain('Delete this entry?');
      expect(confirm).not.toHaveBeenCalled();
      expect(document.querySelector('dialog[open]')).toBeNull();
    });

    it('moves focus to Keep it, the safe choice', () => {
      const { el } = mountPanel();
      el.openEntry(ENTRY);
      deleteButton(el).focus();

      deleteButton(el).click();

      expect(document.activeElement).toBe(keepButton(el));
    });

    it('describes the safe choice by the question, so it is heard with it', () => {
      const { el } = mountPanel();
      el.openEntry(ENTRY);
      deleteButton(el).click();

      const describedBy = keepButton(el).getAttribute('aria-describedby');

      expect(el.querySelector(`#${describedBy}`).textContent).toContain('Delete this entry?');
    });

    it('puts Save and Delete out of the way while it asks, so there is one question', () => {
      const { el } = mountPanel();
      el.openEntry(ENTRY);

      deleteButton(el).click();

      expect(el.hasAttribute('data-confirming-delete')).toBe(true);
      expect(visible(confirmButton(el))).toBe(true);
      expect(visible(keepButton(el))).toBe(true);
    });

    it('deletes that Entry, once, when confirmed', () => {
      const { el, deleteEntry } = mountPanel();
      el.openEntry(ENTRY);
      deleteButton(el).click();

      confirmButton(el).click();
      confirmButton(el).click(); // a second press, or a double-click

      expect(deleteEntry).toHaveBeenCalledOnce();
      expect(deleteEntry).toHaveBeenCalledWith(7);
    });

    it('goes back, with nothing deleted and focus on Delete, when Keep it is pressed', () => {
      const { el, deleteEntry } = mountPanel();
      el.openEntry(ENTRY);
      deleteButton(el).click();

      keepButton(el).click();

      expect(deleteEntry).not.toHaveBeenCalled();
      expect(isAsking(el)).toBe(false);
      expect(el.hasAttribute('data-confirming-delete')).toBe(false);
      expect(document.activeElement).toBe(deleteButton(el));
      expect(visible(deleteButton(el))).toBe(true);
    });

    it('goes back on Escape, and the panel stays open', () => {
      const { el, deleteEntry } = mountPanel();
      el.openEntry(ENTRY);
      deleteButton(el).click();

      const escape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      keepButton(el).dispatchEvent(escape);

      expect(escape.defaultPrevented).toBe(true);
      expect(deleteEntry).not.toHaveBeenCalled();
      expect(isAsking(el)).toBe(false);
      expect(document.activeElement).toBe(deleteButton(el));
      expect(appStore.getState().uipanel).toBe('details');
    });

    it('closes the panel on the next Escape, as before', () => {
      const { el } = mountPanel();
      el.openEntry(ENTRY);
      deleteButton(el).click();
      keepButton(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      deleteButton(el).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );

      expect(appStore.getState().uipanel).not.toBe('details');
    });

    it('is forgotten, unanswered, when another Entry is opened', () => {
      const { el, deleteEntry } = mountPanel();
      el.openEntry(ENTRY);
      deleteButton(el).click();

      el.openEntry({ id: 8, startOffsetMins: 120, endOffsetMins: 150, activity: 'resting' });

      expect(isAsking(el)).toBe(false);
      expect(el.hasAttribute('data-confirming-delete')).toBe(false);
      expect(deleteEntry).not.toHaveBeenCalled();
    });

    it('is forgotten when a new Entry is started, and when the panel is reset', () => {
      const { el } = mountPanel();
      el.openEntry(ENTRY);
      deleteButton(el).click();
      el.openNewEntry(300, 330);
      expect(isAsking(el)).toBe(false);

      el.openEntry(ENTRY);
      deleteButton(el).click();
      el.reset();
      expect(isAsking(el)).toBe(false);
      expect(el.hasAttribute('data-confirming-delete')).toBe(false);
    });

    it('is forgotten when the panel is hidden, and does not come back with it', () => {
      const { el } = mountPanel();
      el.openEntry(ENTRY);
      deleteButton(el).click();

      appStore.dispatch({ type: HIDE_PANEL });
      appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });

      expect(isAsking(el)).toBe(false);
    });

    it('can be asked again after a Keep it', () => {
      const { el, deleteEntry } = mountPanel();
      el.openEntry(ENTRY);
      deleteButton(el).click();
      keepButton(el).click();

      deleteButton(el).click();
      confirmButton(el).click();

      expect(deleteEntry).toHaveBeenCalledOnce();
    });

    it('cannot delete anything when no Entry is open (a new one)', () => {
      const { el, deleteEntry } = mountPanel();
      el.openNewEntry(60, 90);

      deleteButton(el).click();

      expect(isAsking(el)).toBe(false);
      expect(deleteEntry).not.toHaveBeenCalled();
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
