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
  HIDE_PANEL,
  SET_HORIZONTAL_ZOOM,
} from '../../store/actionTypes';

// Resizing an edge that touches a neighbouring Entry moves the neighbour's
// facing boundary too, so the Timeline stays contiguous
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
  },
  {
    name: 'horizontal Timeline',
    tag: 'el-horizontal-timeline',
    Component: HorizontalTimeline,
    at: (mins, el) => ({ clientX: mins * el.getPxPerMinute(), clientY: 0 }),
    position: 'x',
  },
];

describe.each(LAYOUTS)('resizing next to a neighbour - $name', (layout) => {
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
  const B = { id: 2, startOffsetMins: 30, endOffsetMins: 60, activity: 'Walking' };
  const C = { id: 3, startOffsetMins: 90, endOffsetMins: 120, activity: 'Eating' };

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
  const entryOf = (id, dimensionIndex = LOCATION) =>
    stored(dimensionIndex).find((entry) => entry.id === id);
  const rectOf = (id) => el.querySelector(`[data-part="events"] rect[data-id="${id}"]`);
  const span = (id, dimensionIndex = LOCATION) => {
    const { startOffsetMins, endOffsetMins } = entryOf(id, dimensionIndex);
    return [startOffsetMins, endOffsetMins];
  };

  // long-presses the Entry to show its handles, then starts dragging the edge
  function grab(entryId, edge) {
    el.onEntryPointerDown({
      target: rectOf(entryId),
      pointerId: 1,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    vi.advanceTimersByTime(500);
    const hit = el.querySelector(
      `[data-part="drag-handles"] .resize-handle[data-handle-edge="${edge}"] .resize-handle-hit-area`
    );
    el.onEntryPointerDown({
      target: hit,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    return hit;
  }

  const dragTo = (hit, mins) =>
    el.onEntryPointerMove({ target: hit, pointerId: 2, ...layout.at(mins, el) });
  const release = (hit, mins) =>
    el.timeLineElement.dispatchEvent(
      Object.assign(new Event('pointerup', { bubbles: true }), {
        pointerId: 2,
        ...layout.at(mins, el),
      })
    );
  const posOf = (id) => Number(rectOf(id).getAttribute(layout.position));

  it("moves the neighbour's start with the end edge it shares, and commits both together", () => {
    mount(LOCATION, [A, B]);
    const hit = grab(1, 'end');
    const listener = vi.fn();
    appStore.subscribe(listener);

    dragTo(hit, 40);
    release(hit, 40);

    expect(span(1)).toEqual([0, 40]);
    expect(span(2)).toEqual([40, 60]);
    expect(listener).toHaveBeenCalledTimes(1); // one change, not two
  });

  it("moves the neighbour's end with the start edge it shares", () => {
    mount(LOCATION, [A, B]);
    const hit = grab(2, 'start');

    dragTo(hit, 20);
    release(hit, 20);

    expect(span(1)).toEqual([0, 20]);
    expect(span(2)).toEqual([20, 60]);
  });

  it('lengthens the neighbour when the shared edge is dragged away from it', () => {
    mount(LOCATION, [A, B]);
    const hit = grab(1, 'end');

    dragTo(hit, 10);
    release(hit, 10);

    expect(span(1)).toEqual([0, 10]);
    expect(span(2)).toEqual([10, 60]); // B grew to fill the space, no gap
  });

  it('keeps the rest of the neighbour as it was', () => {
    mount(LOCATION, [A, B]);
    const hit = grab(1, 'end');

    dragTo(hit, 40);
    release(hit, 40);

    expect(entryOf(2)).toEqual(expect.objectContaining({ id: 2, activity: 'Walking' }));
  });

  it('shows the neighbour moving while the drag is in progress, without touching the store', () => {
    mount(LOCATION, [A, B]);
    const hit = grab(1, 'end');
    const before = stored();

    dragTo(hit, 40);

    expect(posOf(2)).toBe(layout.at(40, el)[layout.position === 'y' ? 'clientY' : 'clientX']);
    expect(stored()).toBe(before);
  });

  it('stops the drag where the neighbour would shrink below 10 minutes, and says so', () => {
    mount(LOCATION, [A, B]);
    const hit = grab(1, 'end');

    dragTo(hit, 100);

    expect(el.activeDrag.currentEnd).toBe(50); // B ends at 60, so B keeps 10 minutes
    expect(rectOf(1).classList.contains('resize-limit-flash')).toBe(true);
    expect(el.querySelector('.resize-handle-readout').textContent).toMatch(/limit/);
    release(hit, 100);
    expect(span(1)).toEqual([0, 50]);
    expect(span(2)).toEqual([50, 60]);
  });

  it('stops the start edge where the previous neighbour would shrink below 10 minutes', () => {
    mount(LOCATION, [A, B]);
    const hit = grab(2, 'start');

    dragTo(hit, 0);

    expect(el.activeDrag.currentStart).toBe(10);
    release(hit, 0);
    expect(span(1)).toEqual([0, 10]);
    expect(span(2)).toEqual([10, 60]);
  });

  it('never deletes the neighbour, however far it is dragged', () => {
    mount(LOCATION, [A, B, C]);
    const hit = grab(1, 'end');

    dragTo(hit, 1000);
    release(hit, 1000);

    expect(stored()).toHaveLength(3);
    expect(span(3)).toEqual([90, 120]); // beyond the neighbour: untouched
  });

  it('changes only the dragged Entry across a gap, stopping at the next Entry', () => {
    mount(LOCATION, [A, B, C]);
    const hit = grab(2, 'end'); // B ends at 60; C starts at 90: a gap between

    dragTo(hit, 70);
    release(hit, 70);
    expect(span(2)).toEqual([30, 70]);
    expect(span(3)).toEqual([90, 120]);

    const again = grab(2, 'end');
    dragTo(again, 200);
    release(again, 200);
    expect(span(2)).toEqual([30, 90]); // stopped at C, which did not move
    expect(span(3)).toEqual([90, 120]);
  });

  it('changes only the dragged Entry at the edge of the day', () => {
    mount(LOCATION, [A, B]);
    const hit = grab(1, 'start'); // nothing before it

    dragTo(hit, 10);
    release(hit, 10);

    expect(span(1)).toEqual([10, 30]);
    expect(span(2)).toEqual([30, 60]);
  });

  it('puts both Entries back, and stores nothing, when the pointer is cancelled', () => {
    mount(LOCATION, [A, B]);
    const hit = grab(1, 'end');
    const before = stored();
    const aPosition = posOf(1);
    const bPosition = posOf(2);

    dragTo(hit, 40);
    el.timeLineElement.dispatchEvent(
      Object.assign(new Event('pointercancel', { bubbles: true }), { pointerId: 2 })
    );

    expect(stored()).toBe(before);
    expect(posOf(1)).toBe(aPosition);
    expect(posOf(2)).toBe(bPosition);
  });

  it('puts both Entries back, and stores nothing, when Escape is pressed mid-drag', () => {
    mount(LOCATION, [A, B]);
    const hit = grab(1, 'end');
    const before = stored();
    const bPosition = posOf(2);

    dragTo(hit, 40);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(stored()).toBe(before);
    expect(posOf(2)).toBe(bPosition);
  });

  it('leaves the neighbour alone, and changes nothing else, when dragged back to where it began', () => {
    mount(LOCATION, [A, B]);
    const hit = grab(1, 'end');

    dragTo(hit, 40);
    dragTo(hit, 30);
    release(hit, 30);

    expect(span(1)).toEqual([0, 30]);
    expect(span(2)).toEqual([30, 60]);
  });

  it('does not touch a neighbour on a multiple-choice Dimension', () => {
    mount(WHO, [
      { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: ['Partner'] },
      { id: 2, startOffsetMins: 30, endOffsetMins: 60, activity: ['Friends'] },
    ]);
    const hit = grab(1, 'end');

    dragTo(hit, 100);
    release(hit, 100);

    expect(span(1, WHO)).toEqual([0, 100]);
    expect(span(2, WHO)).toEqual([30, 60]);
  });
});
