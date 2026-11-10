import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installSvgTemplates } from '../../testing/svgTemplates';
import { stubPanelActionsKey } from '../../testing/panelActions';
import { Timeline } from './timeline';
import { HorizontalTimeline } from '../horizontalTimeline/horizontalTimeline';
import { appStore } from '../../store/appStore';
import {
  ADD_TIMELINE,
  ADD_ENTRY,
  CLEAR_DIARY,
  SWITCH_DATE,
  SWITCH_DIMENSION,
  SHOW_PANEL,
  HIDE_PANEL,
  SET_HORIZONTAL_ZOOM,
} from '../../store/actionTypes';

// Single-key shortcuts while a Timeline has focus: [ and ] for the previous and
// next Dimension, , and . for the previous and next day, t for today
// (docs/design/flows/keyboard-interaction.md). Both layouts.
const DIMENSIONS = GLOBALS.DATA.timeline;
const TODAY = '2026-11-09'; // a Monday
const LOCATION = 2;

const LAYOUTS = [
  { name: 'vertical Timeline', tag: 'el-timeline', Component: Timeline },
  { name: 'horizontal Timeline', tag: 'el-horizontal-timeline', Component: HorizontalTimeline },
];

describe.each(LAYOUTS)('keyboard shortcuts - $name', (layout) => {
  let timelines;

  beforeEach(() => {
    if (!customElements.get(layout.tag)) {
      customElements.define(layout.tag, layout.Component);
    }
    installSvgTemplates();
    document.body.innerHTML = '';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 9, 12, 0));
    appStore.dispatch({ type: HIDE_PANEL });
    appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: 1 });
    appStore.dispatch({ type: SWITCH_DIMENSION, payload: 0 });
    appStore.dispatch({ type: SWITCH_DATE, payload: '2026-11-05' });
    ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-08', TODAY].forEach((date) => {
      DIMENSIONS.forEach((_, dimensionIndex) =>
        appStore.dispatch({ type: ADD_TIMELINE, payload: { dimensionIndex, date } })
      );
      appStore.dispatch({ type: CLEAR_DIARY, payload: { date } });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    appStore.dispatch({ type: HIDE_PANEL });
  });

  // every Dimension's Timeline, as the stack mounts them
  function mountAll() {
    timelines = DIMENSIONS.map((_, index) => {
      const el = document.createElement(layout.tag);
      el.setAttribute('key', stubPanelActionsKey());
      el.setAttribute('index', String(index));
      document.body.appendChild(el);
      return el;
    });
  }

  const tabStopOf = (index) => timelines[index].querySelector('[tabindex="0"]');
  const focusTimeline = (index) => tabStopOf(index).focus();
  const inTimeline = (index) => timelines[index].contains(document.activeElement);

  function press(key, init = {}, target = document.activeElement) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  const dimension = () => appStore.getState().currentDimensionIndex;
  const date = () => appStore.getState().currentDate;

  describe('Dimensions', () => {
    it('] goes to the next Dimension and focuses its Timeline', () => {
      mountAll();
      focusTimeline(2);

      const event = press(']');

      expect(event.defaultPrevented).toBe(true);
      expect(dimension()).toBe(3);
      expect(inTimeline(3)).toBe(true);
      expect(document.activeElement).toBe(tabStopOf(3));
      expect(document.activeElement.getAttribute('aria-label')).toContain(DIMENSIONS[3].name);
    });

    it('[ goes to the previous Dimension and focuses its Timeline', () => {
      mountAll();
      focusTimeline(3);

      press('[');

      expect(dimension()).toBe(2);
      expect(inTimeline(2)).toBe(true);
    });

    it('wraps round, either way', () => {
      mountAll();
      focusTimeline(DIMENSIONS.length - 1);
      press(']');
      expect(dimension()).toBe(0);
      expect(inTimeline(0)).toBe(true);

      press('[');
      expect(dimension()).toBe(DIMENSIONS.length - 1);
      expect(inTimeline(DIMENSIONS.length - 1)).toBe(true);
    });

    it('goes from the Timeline that has focus, whichever Dimension is current', () => {
      mountAll();
      appStore.dispatch({ type: SWITCH_DIMENSION, payload: 0 });
      focusTimeline(3);

      press(']');

      expect(dimension()).toBe(4);
    });

    it('closes the details panel, as choosing a Dimension does', () => {
      mountAll();
      focusTimeline(2);
      appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });

      press(']');

      expect(appStore.getState().uipanel).not.toBe('details');
    });

    it('keeps going, as focus is on the new Timeline', () => {
      mountAll();
      focusTimeline(0);

      press(']');
      press(']');
      press(']');

      expect(dimension()).toBe(3);
      expect(inTimeline(3)).toBe(true);
    });
  });

  describe('days', () => {
    it('. goes to the next day, and , to the previous, leaving focus on the Timeline', () => {
      mountAll();
      focusTimeline(LOCATION);

      const next = press('.');
      expect(next.defaultPrevented).toBe(true);
      expect(date()).toBe('2026-11-06');
      expect(inTimeline(LOCATION)).toBe(true);

      press(',');
      press(',');
      expect(date()).toBe('2026-11-04');
      expect(inTimeline(LOCATION)).toBe(true);
    });

    it('closes the details panel, as the day buttons do', () => {
      mountAll();
      focusTimeline(LOCATION);
      appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });

      press('.');

      expect(appStore.getState().uipanel).not.toBe('details');
    });

    it('cannot reach a day that has not begun', () => {
      appStore.dispatch({ type: SWITCH_DATE, payload: '2026-11-08' });
      mountAll();
      focusTimeline(LOCATION);

      press('.');
      expect(date()).toBe(TODAY);
      press('.');
      press('.');

      expect(date()).toBe(TODAY);
    });

    it('follows the 04:00 day boundary', () => {
      vi.setSystemTime(new Date(2026, 10, 9, 2, 0)); // still the 8th's Diary day
      appStore.dispatch({ type: SWITCH_DATE, payload: '2026-11-06' });
      mountAll();
      focusTimeline(LOCATION);

      press('.');
      press('.');
      press('.');

      expect(date()).toBe('2026-11-08');
    });

    it('t goes to today, and does nothing there', () => {
      mountAll();
      focusTimeline(LOCATION);

      press('t');
      expect(date()).toBe(TODAY);
      const dispatch = vi.spyOn(appStore, 'dispatch');

      press('t');

      expect(dispatch).not.toHaveBeenCalled();
    });

    it("t is the previous date until 04:00, as the Today button's is", () => {
      vi.setSystemTime(new Date(2026, 10, 9, 3, 30));
      mountAll();
      focusTimeline(LOCATION);

      press('t');

      expect(date()).toBe('2026-11-08');
    });

    it('keeps focus at the same time of day when the day changes', () => {
      appStore.dispatch({
        type: ADD_ENTRY,
        payload: {
          dimensionIndex: LOCATION,
          date: '2026-11-05',
          id: 0,
          startOffsetMins: 60,
          endOffsetMins: 90,
          activity: 'Reading',
        },
      });
      mountAll();
      timelines[LOCATION].querySelector('rect[data-id="0"]').focus();
      expect(document.activeElement.getAttribute('aria-label')).toContain('Reading');

      press('.');

      expect(inTimeline(LOCATION)).toBe(true);
      expect(document.activeElement.getAttribute('aria-label')).toBe(
        `Add entry at 05:00, ${DIMENSIONS[LOCATION].name}`
      );
    });
  });

  describe('only on a Timeline', () => {
    it('does nothing from a text field, a combobox, or anywhere else in the page', () => {
      mountAll();
      const field = document.createElement('input');
      field.setAttribute('role', 'combobox');
      const panel = document.createElement('div');
      panel.appendChild(field);
      document.body.appendChild(panel);
      field.focus();

      for (const key of ['[', ']', ',', '.', 't']) {
        const event = press(key);
        expect(event.defaultPrevented).toBe(false);
      }

      expect(dimension()).toBe(0);
      expect(date()).toBe('2026-11-05');
    });

    it('does nothing from the page itself', () => {
      mountAll();

      press(']', {}, document.body);
      press('.', {}, document.body);

      expect(dimension()).toBe(0);
      expect(date()).toBe('2026-11-05');
    });

    it('ignores Ctrl, Alt and Meta combinations, and Shift, which make other keys', () => {
      mountAll();
      focusTimeline(LOCATION);

      const others = [
        press(']', { ctrlKey: true }),
        press(']', { metaKey: true }),
        press(']', { altKey: true }),
        press('.', { ctrlKey: true }),
        press('t', { ctrlKey: true }),
        press('T', { shiftKey: true }),
      ];

      expect(others.map((event) => event.defaultPrevented)).toEqual(Array(6).fill(false));
      expect(dimension()).toBe(0);
      expect(date()).toBe('2026-11-05');
    });

    it('works with Caps Lock on, which only changes the letter', () => {
      mountAll();
      focusTimeline(LOCATION);

      press('T');

      expect(date()).toBe(TODAY);
    });

    it('is not taken as a shortcut while an Entry is grabbed', () => {
      appStore.dispatch({
        type: ADD_ENTRY,
        payload: {
          dimensionIndex: LOCATION,
          date: '2026-11-05',
          id: 0,
          startOffsetMins: 60,
          endOffsetMins: 90,
          activity: 'Reading',
        },
      });
      mountAll();
      timelines[LOCATION].querySelector('rect[data-id="0"]').focus();
      press(' '); // pick it up

      const keys = [press(']'), press('.'), press('t')];

      expect(keys.map((event) => event.defaultPrevented)).toEqual([false, false, false]);
      expect(dimension()).toBe(0);
      expect(date()).toBe('2026-11-05');
    });
  });
});
