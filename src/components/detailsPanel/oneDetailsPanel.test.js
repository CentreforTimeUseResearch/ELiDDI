import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installSvgTemplates } from '../../testing/svgTemplates';
import '../timelineStack/timelineStack';
import '../horizontalTimelineStack/horizontalTimelineStack';
import { appStore } from '../../store/appStore';
import {
  HIDE_PANEL,
  SHOW_PANEL,
  SWITCH_DATE,
  SWITCH_DIMENSION,
  ADD_TIMELINE,
  ADD_ENTRY,
} from '../../store/actionTypes';
import { getActivityDisplayName } from '../../utils/activities';
import { goToDate, stepDay } from '../../utils/navigation';

// #151 / ADR 0005: one details panel in every layout, routed to the
// current Dimension by DetailsPanelCoordinator. Each test runs against the
// real mobile and desktop stacks.

const DATE = '2026-07-01';
const DIMENSIONS = GLOBALS.DATA.timeline;
const firstActivityOf = (dimensionIndex) =>
  getActivityDisplayName(DIMENSIONS[dimensionIndex].categories[0].activities[0]);

describe.each([
  ['mobile', 'el-timeline-stack', 'el-timeline'],
  ['desktop', 'el-horizontal-timeline-stack', 'el-horizontal-timeline'],
])('one details panel (%s)', (_, stackTag, timelineTag) => {
  let stack;

  beforeEach(() => {
    installSvgTemplates();
    document.body.innerHTML = '';
    appStore.dispatch({ type: SWITCH_DATE, payload: DATE });
    DIMENSIONS.forEach((__, dimensionIndex) =>
      appStore.dispatch({ type: ADD_TIMELINE, payload: { dimensionIndex, date: DATE } })
    );
    appStore.dispatch({ type: SWITCH_DIMENSION, payload: 0 });
    appStore.dispatch({ type: HIDE_PANEL });
    stack = document.createElement(stackTag);
    document.body.appendChild(stack);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    stack.remove();
  });

  const panel = () => document.querySelector('el-details-panel');
  const timelines = () => [...document.querySelectorAll(timelineTag)];
  const switchTo = (dimensionIndex) =>
    appStore.dispatch({ type: SWITCH_DIMENSION, payload: dimensionIndex });
  const startNewEntry = (dimensionIndex, startOffsetMins) =>
    timelines()[dimensionIndex].panelActions.openNewEntry(startOffsetMins);

  // regression coverage (#226): the panel's registerPanelActions wrapper dropped
  // the end time, so a dragged-out block opened the panel one slot long
  it('opens a new Entry with the end time it is given, from a Timeline panelActions', () => {
    timelines()[0].panelActions.openNewEntry(60, 150);

    expect(panel().state.startOffsetMins).toBe(60);
    expect(panel().state.endOffsetMins).toBe(150);
  });

  // #228: Enter on a Timeline opens the panel and then takes focus into it
  it('lets a Timeline move keyboard focus into the panel, from any Dimension', () => {
    HTMLElement.prototype.showPopover = vi.fn(); // jsdom has no Popover API
    try {
      timelines()[1].panelActions.openNewEntry(60, 90);

      timelines()[1].panelActions.focus();

      expect(document.activeElement).toBe(panel().querySelector('[role="combobox"]'));
    } finally {
      delete HTMLElement.prototype.showPopover;
    }
  });

  // #232: whether the panel holds something unsaved, asked through a Timeline's panelActions
  describe('unsaved edits', () => {
    const entry = { id: 5, startOffsetMins: 60, endOffsetMins: 90, activity: 'sleeping' };
    const actions = (dimensionIndex = 0) => timelines()[dimensionIndex].panelActions;

    it('is known through a Timeline panelActions', () => {
      actions().openEntry(entry);
      expect(actions().hasUnsavedEdits()).toBe(false);

      panel().setEndTime(100);

      expect(actions().hasUnsavedEdits()).toBe(true);
    });

    it('is the same answer from every Dimension, as there is one panel', () => {
      actions(0).openEntry(entry);
      panel().setEndTime(100);

      expect(actions(0).hasUnsavedEdits()).toBe(true);
      expect(actions(0).hasUnsavedEdits()).toBe(actions(1).hasUnsavedEdits());
    });

    it('is still unsaved after switching Dimension and back, when it was before', () => {
      actions(0).openEntry(entry);
      panel().setEndTime(100);

      switchTo(1);
      expect(actions(1).hasUnsavedEdits()).toBe(false); // the panel is for the other Dimension now
      switchTo(0);

      expect(panel().state.endOffsetMins).toBe(100);
      expect(actions(0).hasUnsavedEdits()).toBe(true);
    });

    it('is still clean after switching Dimension and back, when it was before', () => {
      actions(0).openEntry(entry);

      switchTo(1);
      switchTo(0);

      expect(actions(0).hasUnsavedEdits()).toBe(false);
    });

    it('is still clean for a new block, after switching Dimension and back', () => {
      actions(0).openNewEntry(300, 330);

      switchTo(2);
      switchTo(0);

      expect(actions(0).hasUnsavedEdits()).toBe(false);
    });

    it('is not carried to another day', () => {
      actions(0).openEntry(entry);
      panel().setEndTime(100);

      appStore.dispatch({ type: SWITCH_DATE, payload: '2026-07-02' });

      expect(actions(0).hasUnsavedEdits()).toBe(false);
    });
  });

  // #243: Delete asks first, then deletes only that Entry and puts focus on the
  // empty slot where it was, however the panel was opened
  describe('deleting an Entry', () => {
    const entries = [
      { id: 0, startOffsetMins: 60, endOffsetMins: 90, activity: 'sleeping' },
      { id: 1, startOffsetMins: 120, endOffsetMins: 150, activity: 'resting' },
    ];

    beforeEach(() => {
      HTMLElement.prototype.showPopover = vi.fn(); // jsdom has no Popover API
      stack.remove();
      appStore.dispatch({ type: SWITCH_DATE, payload: '2026-07-03' });
      DIMENSIONS.forEach((__, dimensionIndex) =>
        appStore.dispatch({
          type: ADD_TIMELINE,
          payload: { dimensionIndex, date: '2026-07-03' },
        })
      );
      entries.forEach((entry) =>
        appStore.dispatch({
          type: ADD_ENTRY,
          payload: { dimensionIndex: 0, date: '2026-07-03', ...entry },
        })
      );
      stack = document.createElement(stackTag);
      document.body.appendChild(stack);
    });

    afterEach(() => {
      delete HTMLElement.prototype.showPopover;
    });

    const stored = () => appStore.getState().diaries['2026-07-03'].timelines[0];
    const openByMouse = (id) =>
      timelines()[0].onTimelineClick({ target: { dataset: { id: String(id) } } });
    const openByKeyboard = (id) => {
      const block = timelines()[0].querySelector(`[data-part="events"] rect[data-id="${id}"]`);
      block.focus();
      block.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );
    };
    const del = () => panel().querySelector('.btn-delete-btn');
    const confirm = () => panel().querySelector('.btn-confirm-delete-btn');
    const keep = () => panel().querySelector('.btn-keep-btn');

    it('does not delete when Delete is pressed, only asks', () => {
      openByMouse(0);
      const before = stored();

      del().click();

      expect(stored()).toBe(before);
      expect(panel().querySelector('.delete-confirm').hasAttribute('hidden')).toBe(false);
    });

    it('deletes only that Entry, in one change, when confirmed', () => {
      openByMouse(0);
      del().click();
      const listener = vi.fn();
      appStore.subscribe(listener);
      const dispatch = vi.spyOn(appStore, 'dispatch');

      confirm().click();

      expect(stored().map((entry) => entry.id)).toEqual([1]);
      expect(dispatch.mock.calls.filter(([action]) => action.type === 'DELETE_ENTRY')).toHaveLength(
        1
      );
    });

    it.each([
      ['a mouse-opened panel', openByMouse],
      ['a keyboard-opened panel', openByKeyboard],
    ])('puts focus on the empty slot where it was, for %s', async (_, open) => {
      open(0);
      del().click();

      confirm().click();
      await Promise.resolve();

      expect(stored().map((entry) => entry.id)).toEqual([1]);
      expect(document.activeElement).toBe(timelines()[0].querySelector('[data-part="slot"]'));
      expect(document.activeElement.getAttribute('aria-label')).toBe(
        `Add entry at 05:00, ${DIMENSIONS[0].name}`
      );
    });

    it('leaves the Entry, the panel and focus on Delete when Keep it is pressed', () => {
      openByMouse(0);
      del().click();

      keep().click();

      expect(stored().map((entry) => entry.id)).toEqual([0, 1]);
      expect(document.activeElement).toBe(del());
      expect(appStore.getState().uipanel).toBe('details');
    });

    it('forgets the question when another Entry is opened, and asks again for that one', () => {
      openByMouse(0);
      del().click();

      openByMouse(1);

      expect(panel().querySelector('.delete-confirm').hasAttribute('hidden')).toBe(true);
      del().click();
      confirm().click();
      expect(stored().map((entry) => entry.id)).toEqual([0]);
    });

    it('does not let a second press delete a different Entry', () => {
      openByMouse(0);
      del().click();
      const button = confirm();

      button.click();
      button.click();

      expect(stored().map((entry) => entry.id)).toEqual([1]);
    });
  });

  // #242: nothing unsaved is lost without asking
  describe('leaving with unsaved edits', () => {
    const DAY = '2026-07-04'; // long past, so the next day is reachable
    const NEXT_DAY = '2026-07-05';
    const entries = [
      { id: 0, startOffsetMins: 60, endOffsetMins: 90, activity: 'sleeping' },
      { id: 1, startOffsetMins: 120, endOffsetMins: 150, activity: 'resting' },
    ];

    beforeEach(() => {
      HTMLElement.prototype.showPopover = vi.fn(); // jsdom has no Popover API
      stack.remove();
      appStore.dispatch({ type: SWITCH_DATE, payload: DAY });
      DIMENSIONS.forEach((__, dimensionIndex) =>
        appStore.dispatch({ type: ADD_TIMELINE, payload: { dimensionIndex, date: DAY } })
      );
      entries.forEach((entry) =>
        appStore.dispatch({ type: ADD_ENTRY, payload: { dimensionIndex: 0, date: DAY, ...entry } })
      );
      appStore.dispatch({
        type: ADD_ENTRY,
        payload: {
          dimensionIndex: 1,
          date: DAY,
          id: 0,
          startOffsetMins: 60,
          endOffsetMins: 90,
          activity: 'tea',
        },
      });
      stack = document.createElement(stackTag);
      document.body.appendChild(stack);
    });

    afterEach(() => {
      delete HTMLElement.prototype.showPopover;
      appStore.dispatch({ type: SWITCH_DATE, payload: DAY });
    });

    const stored = (dimensionIndex = 0) =>
      appStore.getState().diaries[DAY].timelines[dimensionIndex];
    const click = (id, dimensionIndex = 0) =>
      timelines()[dimensionIndex].onTimelineClick({ target: { dataset: { id: String(id) } } });
    const prompt = () => panel().querySelector('.leave-prompt');
    const asking = () => !prompt().hasAttribute('hidden');
    const button = (name) => panel().querySelector(`.btn-leave-${name}`);
    const date = () => appStore.getState().currentDate;
    const dimension = () => appStore.getState().currentDimensionIndex;
    const edit = () => panel().setEndTime(100); // an unsaved change to Entry 0
    const startNew = (start, end) =>
      timelines()[0].startNewEntry({ startOffsetMins: start, endOffsetMins: end, atLimit: false });
    const previewRect = () => timelines()[0].querySelector('[data-part="create-preview"] rect');
    const previewStart = () =>
      Number(previewRect().getAttribute(stackTag.includes('horizontal') ? 'x' : 'y'));

    describe('opening another Entry', () => {
      it('asks, and opens nothing yet, when the panel holds an unsaved edit', () => {
        click(0);
        edit();

        click(1);

        expect(asking()).toBe(true);
        expect(panel().state.id).toBe(0);
        expect(panel().state.endOffsetMins).toBe(100);
        expect(timelines()[0].selectedID).toBe(0); // so Save would still save the right Entry
      });

      it('does not ask when nothing has been changed', () => {
        click(0);

        click(1);

        expect(asking()).toBe(false);
        expect(panel().state.id).toBe(1);
      });

      it('Keep editing leaves the draft as it was, stores nothing, and asks nothing more', () => {
        click(0);
        edit();
        click(1);
        const before = appStore.getState().diaries;
        const dispatch = vi.spyOn(appStore, 'dispatch');

        button('keep').click();

        expect(dispatch).not.toHaveBeenCalled();
        expect(appStore.getState().diaries).toBe(before);
        expect(asking()).toBe(false);
        expect(panel().state).toMatchObject({ id: 0, endOffsetMins: 100 });
        expect(panel().hasUnsavedEdits()).toBe(true);
        expect(timelines()[0].selectedID).toBe(0);
      });

      it('Keep editing puts focus back where the Respondent was', () => {
        click(0);
        edit();
        const block = timelines()[0].querySelector('[data-part="events"] rect[data-id="1"]');
        block.focus();

        click(1);
        button('keep').click();

        expect(document.activeElement.dataset.id).toBe('1'); // the block, as drawn now
      });

      it('Discard opens the Entry that was asked for, and the edit is gone, stored data untouched', () => {
        click(0);
        edit();
        click(1);

        button('discard').click();

        expect(asking()).toBe(false);
        expect(panel().state.id).toBe(1);
        expect(timelines()[0].selectedID).toBe(1);
        expect(stored().find((entry) => entry.id === 0).endOffsetMins).toBe(90);
      });

      it('Save stores the edit, then opens the Entry that was asked for', () => {
        click(0);
        edit();
        click(1);

        button('save').click();

        expect(stored().find((entry) => entry.id === 0).endOffsetMins).toBe(100);
        expect(asking()).toBe(false);
        expect(panel().state.id).toBe(1);
      });

      it('Save that is refused (an overlap) shows why, opens nothing, and loses nothing', () => {
        click(0);
        panel().setEndTime(130); // runs into Entry 1 (120-150)
        click(1);

        button('save').click();

        expect(stored().find((entry) => entry.id === 0).endOffsetMins).toBe(90);
        expect(asking()).toBe(false);
        expect(panel().state).toMatchObject({ id: 0, endOffsetMins: 130 });
        expect(panel().querySelector('.entry-error').hasAttribute('hidden')).toBe(false);
        expect(panel().querySelector('.entry-error').textContent).toContain('overlaps');
        expect(timelines()[0].selectedID).toBe(0);
      });

      it('does not offer Save for an incomplete entry, and says why', () => {
        click(0);
        panel().onSetActivityOnSelectedEntry(''); // an edit, and incomplete

        click(1);

        expect(asking()).toBe(true);
        expect(
          button('save').closest('[hidden]') ?? button('save').hasAttribute('hidden')
        ).toBeTruthy();
        expect(prompt().textContent).toContain('Choose an activity');
      });

      it('asks by keyboard too, with focus on Keep editing rather than taken into the panel', () => {
        click(0);
        edit();
        const block = timelines()[0].querySelector('[data-part="events"] rect[data-id="1"]');
        block.focus();

        block.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
        );

        expect(asking()).toBe(true);
        expect(document.activeElement).toBe(button('keep'));
        expect(panel().state.id).toBe(0);
      });
    });

    describe('starting a new Entry', () => {
      it('asks first when the panel holds an unsaved edit, and shows no block for it yet', () => {
        click(0);
        edit();

        startNew(300, 330);

        expect(asking()).toBe(true);
        expect(panel().state.id).toBe(0);
        expect(previewRect()).toBeNull();
      });

      it('shows the new block, and opens it, once Discard is chosen', () => {
        click(0);
        edit();
        startNew(300, 330);

        button('discard').click();

        expect(panel().state).toMatchObject({ startOffsetMins: 300, endOffsetMins: 330 });
        expect(panel().state.id).toBeUndefined();
        expect(timelines()[0].selectedID).toBeUndefined();
        expect(previewRect()).not.toBeNull();
      });

      it('over an unsaved new Entry: keeps the block the Respondent was working on if they keep editing', () => {
        startNew(300, 330);
        panel().onSetActivityOnSelectedEntry('walking'); // given something, so it is unsaved
        const px = timelines()[0].getPxPerMinute();
        expect(previewStart()).toBe(300 * px);

        startNew(400, 430);
        expect(asking()).toBe(true);
        expect(previewStart()).toBe(300 * px); // still the draft's own block, not the new one

        button('keep').click();

        expect(previewRect()).not.toBeNull();
        expect(previewStart()).toBe(300 * px); // the draft's own block is back
        expect(panel().state).toMatchObject({ startOffsetMins: 300, activity: 'walking' });
      });

      it('does not ask over a new block that was only dragged out and given nothing', () => {
        startNew(300, 330);

        startNew(400, 430);

        expect(asking()).toBe(false);
        expect(panel().state.startOffsetMins).toBe(400);
      });
    });

    describe('changing day', () => {
      it('asks first, and does not change the day yet, when the panel holds an unsaved edit', () => {
        click(0);
        edit();

        const switched = goToDate(appStore, NEXT_DAY);

        expect(switched).toBe(false);
        expect(asking()).toBe(true);
        expect(date()).toBe(DAY);
        expect(panel().state.endOffsetMins).toBe(100);
        expect(appStore.getState().uipanel).toBe('details');
      });

      it('changes the day at once when nothing is unsaved', () => {
        click(0);

        expect(stepDay(appStore, 1)).toBe(true);
        expect(date()).toBe(NEXT_DAY);
      });

      it('Keep editing leaves the day, the draft and the panel exactly as they were', () => {
        click(0);
        edit();
        goToDate(appStore, NEXT_DAY);

        button('keep').click();

        expect(date()).toBe(DAY);
        expect(panel().state).toMatchObject({ id: 0, endOffsetMins: 100 });
        expect(appStore.getState().uipanel).toBe('details');
      });

      it('Discard changes the day, and the edit is gone', () => {
        click(0);
        edit();
        goToDate(appStore, NEXT_DAY);

        button('discard').click();

        expect(date()).toBe(NEXT_DAY);
        expect(panel().state).toEqual({});
        expect(stored().find((entry) => entry.id === 0).endOffsetMins).toBe(90);
      });

      it('Save stores the edit on the day it belongs to, then changes the day', () => {
        click(0);
        edit();
        goToDate(appStore, NEXT_DAY);

        button('save').click();

        expect(date()).toBe(NEXT_DAY);
        expect(stored().find((entry) => entry.id === 0).endOffsetMins).toBe(100);
      });
    });

    describe('closing the panel', () => {
      const escape = () =>
        panel()
          .querySelector('[role="combobox"]')
          .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const chevron = () => panel().querySelector('[data-openCloseButton]');

      it('asks on Escape when the panel holds an unsaved edit, and stays open', () => {
        click(0);
        edit();

        escape();

        expect(asking()).toBe(true);
        expect(appStore.getState().uipanel).toBe('details');
      });

      it('asks on the chevron too', () => {
        click(0);
        edit();

        chevron().click();

        expect(asking()).toBe(true);
        expect(appStore.getState().uipanel).toBe('details');
      });

      it('closes on Escape when nothing is unsaved, and leaves no draft to come back', () => {
        click(0);

        escape();

        expect(appStore.getState().uipanel).not.toBe('details');
        expect(panel().state).toEqual({});
        appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });
        expect(panel().state).toEqual({});
      });

      it('Discard closes it and forgets the edit; Keep editing leaves it open', () => {
        click(0);
        edit();
        escape();
        button('keep').click();
        expect(appStore.getState().uipanel).toBe('details');
        expect(panel().state.endOffsetMins).toBe(100);

        escape();
        button('discard').click();

        expect(appStore.getState().uipanel).not.toBe('details');
        expect(panel().state).toEqual({});
        expect(stored().find((entry) => entry.id === 0).endOffsetMins).toBe(90);
      });

      it('Save closes it, with the edit stored', () => {
        click(0);
        edit();
        escape();

        button('save').click();

        expect(appStore.getState().uipanel).not.toBe('details');
        expect(stored().find((entry) => entry.id === 0).endOffsetMins).toBe(100);
      });
    });

    describe('a Dimension switch', () => {
      const switchAway = (to) => {
        appStore.dispatch({ type: HIDE_PANEL }); // as the tabs and the picker do
        appStore.dispatch({ type: SWITCH_DIMENSION, payload: to });
      };

      it('is not asked about: the draft is parked', () => {
        click(0);
        edit();

        switchAway(1);

        expect(asking()).toBe(false);
        expect(dimension()).toBe(1);
      });

      it('brings the draft back unsaved, and opening an Entry then asks instead of replacing it', () => {
        click(0);
        edit();
        switchAway(1);
        switchAway(0);
        expect(panel().hasUnsavedEdits()).toBe(true);

        click(1);

        expect(asking()).toBe(true);
        expect(panel().state).toMatchObject({ id: 0, endOffsetMins: 100 });
        expect(appStore.getState().uipanel).toBe('details'); // shown, so it can be asked about
      });

      it('opening an Entry in the Dimension where a draft is parked asks, showing that draft', () => {
        click(0);
        edit();
        switchAway(1); // the draft of Dimension 0 is parked

        click(1, 0); // an Entry of Dimension 0, from Dimension 1

        expect(dimension()).toBe(0);
        expect(asking()).toBe(true);
        expect(panel().state).toMatchObject({ id: 0, endOffsetMins: 100 });
      });

      it('opening an Entry in another Dimension does not ask: the draft is parked, not lost', () => {
        click(0);
        edit();

        click(0, 1); // Dimension 1's Entry

        expect(asking()).toBe(false);
        expect(dimension()).toBe(1);
        expect(panel().state.id).toBe(0);
      });

      it('a day change asks about a draft parked in another Dimension, and shows it first', () => {
        click(0);
        edit();
        switchAway(1);
        expect(panel().hasUnsavedEdits()).toBe(false); // the panel is Dimension 1's now

        goToDate(appStore, NEXT_DAY);

        expect(date()).toBe(DAY);
        expect(dimension()).toBe(0); // brought forward
        expect(asking()).toBe(true);
        expect(panel().state).toMatchObject({ id: 0, endOffsetMins: 100 });
      });
    });
  });

  it('serves every Dimension with one panel, retargeted to the current one', () => {
    expect(document.querySelectorAll('el-details-panel')).toHaveLength(1);

    DIMENSIONS.forEach((dimension, dimensionIndex) => {
      switchTo(dimensionIndex);

      expect(panel().getAttribute('dimensionindex')).toBe(String(dimensionIndex));
      expect(panel().getAttribute('heading')).toBe(dimension.description ?? '');
      expect(panel().querySelector('[data-activity]').dataset.activity).toBe(
        firstActivityOf(dimensionIndex)
      );
    });
    expect(document.querySelectorAll('el-details-panel')).toHaveLength(1);
  });

  it('keeps an unsaved draft per Dimension, and follows a Dimension change while open', () => {
    startNewEntry(0, 60);
    panel().setActivity(firstActivityOf(0));
    panel().setEndTime(90);

    switchTo(1);
    expect(appStore.getState().uipanel).toBe('details'); // still open
    expect(panel().state).toEqual({});

    switchTo(0);
    expect(panel().state).toEqual({
      startOffsetMins: 60,
      endOffsetMins: 90,
      activity: firstActivityOf(0),
    });
  });

  it('replaces a parked draft when that Dimension is opened afresh', () => {
    startNewEntry(0, 60);
    panel().setActivity(firstActivityOf(0));
    switchTo(1);

    startNewEntry(0, 120);

    expect(panel().getAttribute('dimensionindex')).toBe('0');
    expect(panel().state).toEqual({ startOffsetMins: 120, endOffsetMins: 130 });
  });

  it('ends every draft when the Diary date changes', () => {
    startNewEntry(0, 60);
    panel().setActivity(firstActivityOf(0));
    switchTo(1);
    startNewEntry(1, 200);

    appStore.dispatch({ type: SWITCH_DATE, payload: '2026-07-02' });
    expect(panel().state).toEqual({});
    switchTo(0);

    expect(panel().state).toEqual({});
  });

  it("saves to the current Dimension's Timeline", () => {
    startNewEntry(2, 60);
    panel().setActivity(firstActivityOf(2));
    panel().setEndTime(90);

    panel().querySelector('.btn-save-btn').click();

    expect(appStore.getState().diaries[DATE].timelines[2]).toEqual([
      expect.objectContaining({
        startOffsetMins: 60,
        endOffsetMins: 90,
        activity: firstActivityOf(2),
      }),
    ]);
  });

  // the dangling references #151 listed, which affected both layouts
  describe('form references', () => {
    const ids = (attribute) =>
      [...panel().querySelectorAll(`[${attribute}]`)].flatMap((element) =>
        element.getAttribute(attribute).split(/\s+/).filter(Boolean)
      );

    it('gives every id in the panel a single owner in the whole document', () => {
      [...panel().querySelectorAll('[id]')].forEach((element) => {
        expect(document.querySelectorAll(`[id="${element.id}"]`), element.id).toHaveLength(1);
      });
    });

    it('resolves every label and aria reference to an element inside the panel', () => {
      const referenced = [
        ...[...panel().querySelectorAll('label[for]')].map((label) => label.htmlFor),
        ...ids('aria-describedby'),
        ...ids('aria-labelledby'),
        ...ids('aria-controls'),
      ];
      expect(referenced.length).toBeGreaterThan(0);
      referenced.forEach((id) => {
        expect(panel().contains(document.getElementById(id)), id).toBe(true);
      });
    });

    it('labels the start and end time inputs', () => {
      ['startTime', 'endTime'].forEach((inputId) => {
        const input = panel().querySelector(`[data-id="${inputId}"]`);
        expect(input.labels, inputId).toHaveLength(1);
      });
    });
  });
});
