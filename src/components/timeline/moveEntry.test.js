import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installSvgTemplates } from '../../testing/svgTemplates';
import { stubPanelActionsKey } from '../../testing/panelActions';
import { Timeline } from './timeline';
import { HorizontalTimeline } from '../horizontalTimeline/horizontalTimeline';
import { appStore } from '../../store/appStore';
import {
  ADD_TIMELINE,
  ADD_ENTRY,
  SWITCH_DATE,
  SHOW_PANEL,
  HIDE_PANEL,
  SET_HORIZONTAL_ZOOM,
} from '../../store/actionTypes';

// Dragging an Entry by its body moves it, keeping its duration
// (docs/design/flows/move-resize.md). Run on both layouts.
const PAST_DATE = '2020-01-01'; // no "now" limit
const LOCATION = 2; // single-choice
const WHO = 3; // multiple-choice

const LAYOUTS = [
  {
    name: 'vertical Timeline',
    tag: 'el-timeline',
    Component: Timeline,
    at: (mins) => ({ clientX: 0, clientY: mins * 2 }),
    position: 'y',
    size: 'height',
    pxPerMinute: () => 2,
  },
  {
    name: 'horizontal Timeline',
    tag: 'el-horizontal-timeline',
    Component: HorizontalTimeline,
    at: (mins, el) => ({ clientX: mins * el.getPxPerMinute(), clientY: 0 }),
    position: 'x',
    size: 'width',
    pxPerMinute: (el) => el.getPxPerMinute(),
  },
];

describe.each(LAYOUTS)('moving an Entry by its body - $name', (layout) => {
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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    appStore.dispatch({ type: HIDE_PANEL });
  });

  const A = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
  const B = { id: 2, startOffsetMins: 60, endOffsetMins: 100, activity: 'Walking' }; // the one moved
  const C = { id: 3, startOffsetMins: 100, endOffsetMins: 160, activity: 'Eating' }; // touches B
  const D = { id: 4, startOffsetMins: 200, endOffsetMins: 260, activity: 'Sleeping' };

  function mount(dimensionIndex, entries) {
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
  }

  const stored = (dimensionIndex = LOCATION) =>
    appStore.getState().diaries[PAST_DATE].timelines[dimensionIndex];
  const span = (id, dimensionIndex = LOCATION) => {
    const entry = stored(dimensionIndex).find((entry) => entry.id === id);
    return [entry.startOffsetMins, entry.endOffsetMins];
  };
  const rectOf = (id) => el.querySelector(`[data-part="events"] rect[data-id="${id}"]`);
  const liveSpan = (id) => {
    const rect = rectOf(id);
    const px = layout.pxPerMinute(el);
    const start = Number(rect.getAttribute(layout.position)) / px;
    return [start, start + Number(rect.getAttribute(layout.size)) / px];
  };

  const press = (id, mins, pointerType = 'mouse', pointerId = 1) =>
    el.onEntryPointerDown({
      target: rectOf(id),
      pointerId,
      pointerType,
      button: 0,
      ...layout.at(mins, el),
    });
  const moveTo = (id, mins, pointerId = 1) =>
    el.onEntryPointerMove({ target: rectOf(id), pointerId, ...layout.at(mins, el) });
  const fire = (type, mins, pointerId = 1) =>
    el.timeLineElement.dispatchEvent(
      Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
        pointerId,
        ...layout.at(mins, el),
      })
    );
  const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

  // grabs B in the middle, at 80, and drags it by `delta` minutes
  function dragB(delta, { release = true } = {}) {
    press(2, 80);
    moveTo(2, 80 + delta);
    if (release) {
      fire('pointerup', 80 + delta);
    }
  }

  describe('with a mouse', () => {
    it('moves the Entry, keeping its duration, and commits it on release', () => {
      mount(LOCATION, [A, B]);

      dragB(-20); // 60-100 -> 40-80: in the free space

      expect(span(2)).toEqual([40, 80]);
      expect(span(1)).toEqual([0, 30]);
    });

    it('moves later too', () => {
      mount(LOCATION, [A, B]);

      dragB(50);

      expect(span(2)).toEqual([110, 150]);
    });

    it('shows the Entry moving while the pointer is down, without touching the store', () => {
      mount(LOCATION, [A, B]);
      const before = stored();

      dragB(50, { release: false });

      expect(liveSpan(2)).toEqual([110, 150]);
      expect(stored()).toBe(before);
    });

    it('snaps to the 10-minute grid', () => {
      mount(LOCATION, [A, B]);

      press(2, 80);
      moveTo(2, 80 + 47);
      fire('pointerup', 80 + 47);

      expect(span(2)).toEqual([100, 140]); // 47 minutes of pointer -> 40 of move
    });

    it('trims the Entry ahead on its facing side when slid over it, and commits both as one change', () => {
      mount(LOCATION, [A, B, C]);
      const listener = vi.fn();
      appStore.subscribe(listener);

      dragB(30); // 60-100 -> 90-130: over C's first 30 minutes

      expect(span(2)).toEqual([90, 130]);
      expect(span(3)).toEqual([130, 160]);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('trims the Entry behind on its facing side when slid over it', () => {
      mount(LOCATION, [A, B]);

      dragB(-50); // 60-100 -> 10-50: over A's last 20 minutes

      expect(span(2)).toEqual([10, 50]);
      expect(span(1)).toEqual([0, 10]);
    });

    it('shows the trimmed neighbour while the pointer is down', () => {
      mount(LOCATION, [A, B, C]);

      dragB(30, { release: false });

      expect(liveSpan(3)).toEqual([130, 160]);
    });

    it('stops where the Entry ahead would be left with 10 minutes, and says so', () => {
      mount(LOCATION, [A, B, C, D]);

      dragB(500, { release: false });

      expect(el.activeDrag.currentStart).toBe(110);
      expect(rectOf(2).classList.contains('resize-limit-flash')).toBe(true);
      expect(el.querySelector('.resize-handle-readout').textContent).toMatch(/limit/);
      fire('pointerup', 580);
      expect(span(2)).toEqual([110, 150]);
      expect(span(3)).toEqual([150, 160]);
    });

    it('stops where the Entry behind would be left with 10 minutes', () => {
      mount(LOCATION, [A, B]);

      dragB(-500);

      expect(span(2)).toEqual([10, 50]);
      expect(span(1)).toEqual([0, 10]);
    });

    it('never swaps with, or deletes, an Entry', () => {
      mount(LOCATION, [A, B, C, D]);

      dragB(1000);

      expect(stored()).toHaveLength(4);
      expect(span(4)).toEqual([200, 260]);
    });

    it('does not extend the Entry behind into the space it leaves', () => {
      mount(LOCATION, [A, B, C]);

      dragB(-10); // B 60-100 -> 50-90: nothing is touching it behind

      expect(span(1)).toEqual([0, 30]);
    });

    it('puts everything back, and stores nothing, when the pointer is cancelled', () => {
      mount(LOCATION, [A, B, C]);
      const before = stored();

      dragB(30, { release: false });
      fire('pointercancel', 110);

      expect(stored()).toBe(before);
      expect(liveSpan(2)).toEqual([60, 100]);
      expect(liveSpan(3)).toEqual([100, 160]);
    });

    it('puts everything back, and stores nothing, on Escape, and swallows the click that follows', () => {
      mount(LOCATION, [A, B, C]);
      const before = stored();

      dragB(30, { release: false });
      escape();
      moveTo(2, 200); // the pointer is still down: ignored
      fire('pointerup', 200);

      expect(stored()).toBe(before);
      expect(liveSpan(2)).toEqual([60, 100]);
      expect(liveSpan(3)).toEqual([100, 160]);
      expect(el.resizeController.consumeSuppressedClick()).toBe(true);
    });

    it('swallows the click that ends a move, so the Entry does not also open', () => {
      mount(LOCATION, [A, B]);
      const openEntry = vi.fn();
      el.panelActions.openEntry = openEntry;

      dragB(-20);
      el.onTimelineClick({ target: { dataset: { id: '2' } } });

      expect(openEntry).not.toHaveBeenCalled();
    });

    it('stores nothing, and keeps the handles, when it ends where it began', () => {
      mount(LOCATION, [A, B]);
      const listener = vi.fn();
      appStore.subscribe(listener);

      press(2, 80);
      moveTo(2, 130);
      moveTo(2, 80);
      fire('pointerup', 80);

      expect(listener).not.toHaveBeenCalled();
      expect(span(2)).toEqual([60, 100]);
      expect(el.activeHandleEntryId).toBe(2);
    });

    it('leaves a press that hardly moves to the click', () => {
      mount(LOCATION, [A, B]);

      press(2, 80);
      moveTo(2, 82);
      fire('pointerup', 82);

      expect(el.activeDrag).toBeUndefined();
      expect(span(2)).toEqual([60, 100]);
      expect(el.resizeController.consumeSuppressedClick()).toBe(false);
    });

    it('shows the start and end handles, with the new times as text, while moving', () => {
      mount(LOCATION, [A, B]);

      dragB(-20, { release: false });

      expect(el.querySelectorAll('.resize-handle')).toHaveLength(2);
      expect(el.querySelector('.resize-handle-readout').textContent).toBe('04:40–05:20');
    });

    it('keeps the handles up, at the new position, after the move', () => {
      mount(LOCATION, [A, B]);

      dragB(-20);

      expect(el.activeHandleEntryId).toBe(2);
      expect(el.querySelector('.resize-handle')).not.toBeNull();
    });

    it('does not start while the details panel is open', () => {
      mount(LOCATION, [A, B]);
      appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });

      dragB(-20);

      expect(el.activeDrag).toBeUndefined();
      expect(span(2)).toEqual([60, 100]);
    });

    it('ignores a non-primary mouse button', () => {
      mount(LOCATION, [A, B]);

      el.onEntryPointerDown({
        target: rectOf(2),
        pointerId: 1,
        pointerType: 'mouse',
        button: 2,
        ...layout.at(80, el),
      });
      moveTo(2, 130);

      expect(el.activeDrag).toBeUndefined();
    });

    it('keeps the SVG from panning for the drag only', () => {
      mount(LOCATION, [A, B]);

      dragB(-20, { release: false });
      expect(el.timeLineElement.classList.contains('dragging-handle')).toBe(true);

      fire('pointerup', 60);
      expect(el.timeLineElement.classList.contains('dragging-handle')).toBe(false);
    });

    it('lets Entries overlap on a multiple-choice Dimension', () => {
      mount(WHO, [
        { id: 1, startOffsetMins: 60, endOffsetMins: 100, activity: ['Partner'] },
        { id: 2, startOffsetMins: 100, endOffsetMins: 160, activity: ['Friends'] },
      ]);

      press(1, 80);
      moveTo(1, 80 + 60);
      fire('pointerup', 80 + 60);

      expect(span(1, WHO)).toEqual([120, 160]);
      expect(span(2, WHO)).toEqual([100, 160]); // untouched
    });
  });

  describe('with a touch', () => {
    it('moves after a long-press, in the same gesture', () => {
      mount(LOCATION, [A, B]);

      press(2, 80, 'touch');
      vi.advanceTimersByTime(500); // long-press: handles appear
      moveTo(2, 60);
      fire('pointerup', 60);

      expect(span(2)).toEqual([40, 80]);
    });

    it('does not move, and leaves the scroll alone, if the finger moves before the long-press', () => {
      mount(LOCATION, [A, B]);
      const scroll = { preventDefault: vi.fn() };

      press(2, 80, 'touch');
      moveTo(2, 140);
      el.resizeController.handleTouchMove(scroll);
      vi.advanceTimersByTime(500);
      moveTo(2, 160);
      fire('pointerup', 160);

      expect(el.activeDrag).toBeUndefined();
      expect(span(2)).toEqual([60, 100]);
      expect(scroll.preventDefault).not.toHaveBeenCalled();
    });

    it('keeps the page from scrolling once the long-press has armed the move', () => {
      mount(LOCATION, [A, B]);
      const move = { preventDefault: vi.fn() };

      press(2, 80, 'touch');
      vi.advanceTimersByTime(500);
      el.resizeController.handleTouchMove(move);

      expect(move.preventDefault).toHaveBeenCalled();
    });

    it('does not move on a later touch once the finger has been lifted', () => {
      mount(LOCATION, [A, B]);

      press(2, 80, 'touch');
      vi.advanceTimersByTime(500);
      fire('pointerup', 80);
      moveTo(2, 140);

      expect(el.activeDrag).toBeUndefined();
      expect(span(2)).toEqual([60, 100]);
    });

    it('swallows the click that ends the long-press and move', () => {
      mount(LOCATION, [A, B]);
      const openEntry = vi.fn();
      el.panelActions.openEntry = openEntry;

      press(2, 80, 'touch');
      vi.advanceTimersByTime(500);
      moveTo(2, 60);
      fire('pointerup', 60);
      el.onTimelineClick({ target: { dataset: { id: '2' } } });

      expect(openEntry).not.toHaveBeenCalled();
    });
  });
});
