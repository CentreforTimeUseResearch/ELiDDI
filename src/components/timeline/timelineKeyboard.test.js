import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installSvgTemplates } from '../../testing/svgTemplates';
import { stubPanelActionsKey } from '../../testing/panelActions';
import { Timeline } from './timeline';
import { HorizontalTimeline } from '../horizontalTimeline/horizontalTimeline';
import { appStore } from '../../store/appStore';
import {
  ADD_TIMELINE,
  ADD_ENTRY,
  DELETE_ENTRY,
  SWITCH_DATE,
  SWITCH_DIMENSION,
  SHOW_PANEL,
  HIDE_PANEL,
  SET_HORIZONTAL_ZOOM,
} from '../../store/actionTypes';

// Keyboard access to a Timeline (docs/design/flows/keyboard-interaction.md):
// a group with one Tab stop, roving focus over Entries and empty slots along
// the time axis, names for each, and Enter to open or create. Both layouts.
const PAST_DATE = '2020-01-01'; // no "now" limit
const LOCATION = 2; // "Location", single-choice
const WHO = 3; // "Who", multiple-choice

const LAYOUTS = [
  {
    name: 'vertical Timeline',
    tag: 'el-timeline',
    Component: Timeline,
    next: 'ArrowDown',
    previous: 'ArrowUp',
    crossAxisKey: 'ArrowLeft',
    position: 'y',
    size: 'height',
  },
  {
    name: 'horizontal Timeline',
    tag: 'el-horizontal-timeline',
    Component: HorizontalTimeline,
    next: 'ArrowRight',
    previous: 'ArrowLeft',
    crossAxisKey: 'ArrowDown',
    position: 'x',
    size: 'width',
  },
];

describe.each(LAYOUTS)('keyboard access - $name', (layout) => {
  let el;

  beforeEach(() => {
    if (!customElements.get(layout.tag)) {
      customElements.define(layout.tag, layout.Component);
    }
    installSvgTemplates();
    document.body.innerHTML = '';
    appStore.dispatch({ type: HIDE_PANEL });
    appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: 1 });
    appStore.dispatch({ type: SWITCH_DATE, payload: PAST_DATE });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    appStore.dispatch({ type: HIDE_PANEL });
  });

  const A = { id: 1, startOffsetMins: 60, endOffsetMins: 90, activity: 'Walking' };
  const B = { id: 2, startOffsetMins: 90, endOffsetMins: 120, activity: 'Eating' };

  function mount(dimensionIndex, entries = []) {
    appStore.dispatch({ type: ADD_TIMELINE, payload: { dimensionIndex, date: PAST_DATE } });
    entries.forEach((entry) =>
      appStore.dispatch({
        type: ADD_ENTRY,
        payload: { dimensionIndex, date: PAST_DATE, ...entry },
      })
    );
    el = document.createElement(layout.tag);
    el.setAttribute('key', stubPanelActionsKey());
    el.setAttribute('index', String(dimensionIndex));
    document.body.appendChild(el);
    // like the real panel coordinator: the Dimension becomes current and the panel shows
    const showPanel = () => {
      appStore.dispatch({ type: SWITCH_DIMENSION, payload: dimensionIndex });
      appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });
    };
    el.panelActions.openEntry = vi.fn(showPanel);
    el.panelActions.openNewEntry = vi.fn(showPanel);
    el.panelActions.focus = vi.fn();
    return el;
  }

  const tabStops = () => [...el.querySelectorAll('[tabindex="0"]')];
  const rectOf = (id) => el.querySelector(`[data-part="events"] rect[data-id="${id}"]`);
  const focused = () => document.activeElement;
  const label = () => focused()?.getAttribute('aria-label');
  const ring = () => el.querySelector('[data-part="focus-ring"] rect');

  function enter() {
    tabStops()[0].focus();
  }

  function press(key, init = {}) {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    focused().dispatchEvent(event);
    return event;
  }

  describe('what the Timeline is', () => {
    it('is a group named for its Dimension', () => {
      mount(LOCATION);

      const svg = el.timeLineElement;
      expect(svg.getAttribute('role')).toBe('group');
      expect(svg.getAttribute('aria-label')).toBe('Location timeline');
    });

    it('has exactly one Tab stop, at the start of the day', () => {
      mount(LOCATION, [A, B]);

      expect(tabStops()).toHaveLength(1);
      expect(tabStops()[0].getAttribute('aria-label')).toBe('Add entry at 04:00, Location');
    });

    it('names an Entry with its activity, times and Dimension', () => {
      mount(LOCATION, [A]);

      const rect = rectOf(1);
      expect(rect.getAttribute('role')).toBe('button');
      expect(rect.getAttribute('aria-label')).toBe('Walking, 05:00 to 05:30, Location');
      expect(rect.getAttribute('tabindex')).toBe('-1');
    });

    it('names an Entry with several activities by all of them', () => {
      mount(WHO, [
        { id: 1, startOffsetMins: 60, endOffsetMins: 90, activity: ['Partner', 'Friends'] },
      ]);

      expect(rectOf(1).getAttribute('aria-label')).toBe('Partner, Friends, 05:00 to 05:30, Who');
    });

    it("does not repeat an Entry's label to assistive technology", () => {
      mount(LOCATION, [A]);

      expect(
        el.querySelector('[data-part="events"] foreignObject').getAttribute('aria-hidden')
      ).toBe('true');
    });

    it('does not make the read-only mirror strip focusable', () => {
      appStore.dispatch({ type: ADD_TIMELINE, payload: { dimensionIndex: 0, date: PAST_DATE } });
      appStore.dispatch({
        type: ADD_ENTRY,
        payload: { dimensionIndex: 0, date: PAST_DATE, ...A },
      });
      mount(LOCATION);

      expect(el.querySelector('[data-part="timeline-shadow"] [tabindex]')).toBeNull();
      expect(el.querySelector('[data-part="timeline-shadow"] [role]')).toBeNull();
    });
  });

  describe('moving along the time axis', () => {
    it('moves to the next and previous slot, keeping one Tab stop', () => {
      mount(LOCATION);
      enter();

      const event = press(layout.next);

      expect(event.defaultPrevented).toBe(true);
      expect(label()).toBe('Add entry at 04:10, Location');
      expect(tabStops()).toHaveLength(1);
      expect(tabStops()[0]).toBe(focused());

      press(layout.previous);
      expect(label()).toBe('Add entry at 04:00, Location');
    });

    it('stays at the start of the day going back, and the end going on', () => {
      mount(LOCATION);
      enter();

      press(layout.previous);
      expect(label()).toBe('Add entry at 04:00, Location');

      press('End');
      press(layout.next);
      expect(label()).toBe('Add entry at 03:50, Location');
    });

    it('goes into an Entry, and out of it to the slot after', () => {
      mount(LOCATION, [A]);
      enter();
      press('PageDown'); // 04:00 -> 05:00: the Entry

      expect(focused()).toBe(rectOf(1));
      expect(tabStops()).toEqual([rectOf(1)]);

      press(layout.next);
      expect(label()).toBe('Add entry at 05:30, Location');
      press(layout.previous);
      expect(focused()).toBe(rectOf(1));
    });

    it('goes from one Entry straight to the next when they touch', () => {
      mount(LOCATION, [A, B]);
      enter();
      press('PageDown');

      press(layout.next);

      expect(focused()).toBe(rectOf(2));
    });

    it('jumps to the start and end of the day with Home and End', () => {
      mount(LOCATION, [A]);
      enter();

      press('End');
      expect(label()).toBe('Add entry at 03:50, Location');

      press('Home');
      expect(label()).toBe('Add entry at 04:00, Location');
    });

    it('jumps an hour with PageDown and PageUp', () => {
      mount(LOCATION);
      enter();

      press('PageDown');
      expect(label()).toBe('Add entry at 05:00, Location');
      press('PageDown');
      expect(label()).toBe('Add entry at 06:00, Location');
      press('PageUp');
      expect(label()).toBe('Add entry at 05:00, Location');
    });

    it('lets the other arrow keys, and modified keys, through untouched', () => {
      mount(LOCATION);
      enter();
      const start = focused();

      const cross = press(layout.crossAxisKey);
      const modified = press(layout.next, { ctrlKey: true });
      const alt = press(layout.next, { altKey: true });
      const letter = press('a');

      expect([cross, modified, alt, letter].map((e) => e.defaultPrevented)).toEqual([
        false,
        false,
        false,
        false,
      ]);
      expect(focused()).toBe(start);
    });

    it('follows a click on an Entry: the next key goes on from there', () => {
      mount(LOCATION, [A, B]);
      document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      rectOf(1).focus(); // a click focuses it

      press(layout.next);

      expect(focused()).toBe(rectOf(2));
    });
  });

  describe('opening and creating', () => {
    it('opens an Entry in the panel with Enter, and moves focus into the panel', () => {
      mount(LOCATION, [A]);
      enter();
      press('PageDown');

      const event = press('Enter');

      expect(event.defaultPrevented).toBe(true);
      expect(el.panelActions.openEntry).toHaveBeenCalledOnce();
      expect(el.panelActions.openEntry.mock.calls[0][0]).toMatchObject({ id: 1 });
      expect(el.panelActions.focus).toHaveBeenCalled();
    });

    it('makes a 30-minute block from a slot with Enter, and shows it', () => {
      mount(LOCATION);
      enter();
      press('PageDown'); // 05:00

      press('Enter');

      expect(el.panelActions.openNewEntry).toHaveBeenCalledWith(60, 90);
      expect(el.panelActions.focus).toHaveBeenCalled();
      expect(el.querySelector('[data-part="create-preview"] rect')).not.toBeNull();
    });

    it('shortens that block to the free time before the next Entry', () => {
      mount(LOCATION, [{ id: 1, startOffsetMins: 80, endOffsetMins: 120, activity: 'Walking' }]);
      enter();
      press('PageDown');

      press('Enter');

      expect(el.panelActions.openNewEntry).toHaveBeenCalledWith(60, 80);
    });

    it('does nothing for keys it does not use', () => {
      mount(LOCATION, [A]);
      enter();

      press('Enter');
      press('Escape');
      press('x');

      expect(el.panelActions.openEntry).not.toHaveBeenCalled();
    });
  });

  describe('the focus ring', () => {
    it('shows around the focused slot when using the keyboard, and follows it', () => {
      mount(LOCATION);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      enter();

      expect(ring()).not.toBeNull();
      expect(Number(ring().getAttribute(layout.position))).toBe(0);

      press('PageDown');
      const pxPerMinute = el.getPxPerMinute();
      expect(Number(ring().getAttribute(layout.position))).toBe(60 * pxPerMinute);
      expect(Number(ring().getAttribute(layout.size))).toBe(10 * pxPerMinute);
    });

    it('covers a whole Entry when one is focused', () => {
      mount(LOCATION, [A]);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      enter();

      press('PageDown');

      expect(Number(ring().getAttribute(layout.size))).toBe(30 * el.getPxPerMinute());
    });

    it('goes when focus leaves the Timeline', () => {
      mount(LOCATION);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      enter();

      focused().blur();

      expect(ring()).toBeNull();
    });

    it('is not drawn for a mouse click', () => {
      mount(LOCATION, [A]);
      document.dispatchEvent(new Event('pointerdown', { bubbles: true }));

      rectOf(1).focus();

      expect(ring()).toBeNull();
    });
  });

  describe('keeping focus', () => {
    it('stays on an Entry when the Timeline redraws', () => {
      mount(LOCATION, [A]);
      enter();
      press('PageDown');
      const before = rectOf(1);

      el.renderEntries();

      expect(rectOf(1)).not.toBe(before); // a new element...
      expect(focused()).toBe(rectOf(1)); // ...that has focus
      expect(tabStops()).toEqual([rectOf(1)]);
    });

    it('moves to the slot where an Entry was, when it is deleted', () => {
      mount(LOCATION, [A]);
      enter();
      press('PageDown');

      appStore.dispatch({
        type: DELETE_ENTRY,
        payload: { dimensionIndex: LOCATION, date: PAST_DATE, id: 1 },
      });
      el.renderEntries();

      expect(label()).toBe('Add entry at 05:00, Location');
    });

    it('does not take focus when it was not in the Timeline', () => {
      mount(LOCATION, [A]);
      const outside = document.createElement('button');
      document.body.appendChild(outside);
      outside.focus();

      el.renderEntries();

      expect(focused()).toBe(outside);
    });

    it('moves a slot cursor onto an Entry that now covers it', () => {
      mount(LOCATION);
      enter();
      press('PageDown'); // 05:00
      appStore.dispatch({
        type: ADD_ENTRY,
        payload: { dimensionIndex: LOCATION, date: PAST_DATE, ...A },
      });

      el.renderEntries();

      expect(focused()).toBe(rectOf(1));
      expect(tabStops()).toEqual([rectOf(1)]);
    });

    it('returns to the Entry when the panel is closed without saving', async () => {
      mount(LOCATION, [A]);
      enter();
      press('PageDown');
      press('Enter');
      document.body.focus(); // focus went into the panel, then away

      appStore.dispatch({ type: HIDE_PANEL });
      await Promise.resolve();

      expect(focused()).toBe(rectOf(1));
    });

    it('returns to the slot when a new Entry is cancelled', async () => {
      mount(LOCATION);
      enter();
      press('PageDown');
      press('Enter');
      document.body.focus();

      appStore.dispatch({ type: HIDE_PANEL });
      await Promise.resolve();

      expect(label()).toBe('Add entry at 05:00, Location');
    });

    it('goes to the new Entry when it is saved', async () => {
      mount(LOCATION);
      enter();
      press('PageDown');
      press('Enter');
      document.body.focus();

      el.saveEntry({ startOffsetMins: 60, endOffsetMins: 90, activity: 'Walking' });
      await Promise.resolve();

      expect(focused()).toBe(el.querySelector('[data-part="events"] rect'));
      expect(label()).toBe('Walking, 05:00 to 05:30, Location');
    });

    it('does not pull focus back after a mouse-opened panel closes', async () => {
      mount(LOCATION, [A]);
      el.onTimelineClick({ target: { dataset: { id: '1' } } });
      appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });
      const outside = document.createElement('button');
      document.body.appendChild(outside);
      outside.focus();

      appStore.dispatch({ type: HIDE_PANEL });
      await Promise.resolve();

      expect(focused()).toBe(outside);
    });
  });
});
