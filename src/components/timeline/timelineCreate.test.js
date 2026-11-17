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
  SWITCH_DIMENSION,
  SET_HORIZONTAL_ZOOM,
} from '../../store/actionTypes';

// The create gesture on the real elements: press and drag on empty time to
// paint a new Entry (docs/design/flows/create-entry.md). jsdom has no SVG
// geometry, so a pointer's clientY (vertical) or clientX (horizontal) is
// already its SVG coordinate along the time axis.
const PAST_DATE = '2020-01-01'; // no "now" limit

// a Dimension that is single-choice (Primary activity, 0) and one that is not (Who, 3)
const PRIMARY = 0;
const WHO = 3;

const LAYOUTS = [
  {
    name: 'vertical Timeline',
    tag: 'el-timeline',
    Component: Timeline,
    pxPerMinute: 2,
    // the pointer position along the time axis for a given offset
    at: (mins) => ({ clientX: 0, clientY: mins * 2 }),
    previewRect: { position: 'y', size: 'height' },
  },
  {
    name: 'horizontal Timeline',
    tag: 'el-horizontal-timeline',
    Component: HorizontalTimeline,
    pxPerMinute: null, // follows the zoom, read from the element
    at: (mins, el) => ({ clientX: mins * el.getPxPerMinute(), clientY: 0 }),
    previewRect: { position: 'x', size: 'width' },
  },
];

describe.each(LAYOUTS)('drag to create - $name', (layout) => {
  let el;
  let openNewEntry;

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

  function mount(dimensionIndex = PRIMARY, entries = []) {
    appStore.dispatch({
      type: ADD_TIMELINE,
      payload: { dimensionIndex, date: PAST_DATE },
    });
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
    // like the real details panel coordinator: makes this Dimension current
    // and shows the panel, then pre-fills it
    openNewEntry = vi.fn(() => {
      appStore.dispatch({ type: SWITCH_DIMENSION, payload: dimensionIndex });
      appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });
    });
    el.panelActions.openNewEntry = openNewEntry;
    return el;
  }

  const zone = () => el.querySelector('[data-part="gridline-zone"]');
  const preview = () => el.querySelector('[data-part="create-preview"] rect');

  function fire(type, mins, overrides = {}) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      ...layout.at(mins, el),
      ...overrides,
    });
    zone().dispatchEvent(event);
    return event;
  }

  function click(mins) {
    const event = new MouseEvent('click', { bubbles: true, ...layout.at(mins, el) });
    zone().dispatchEvent(event);
  }

  function drag(fromMins, toMins) {
    fire('pointerdown', fromMins);
    fire('pointermove', toMins);
    fire('pointerup', toMins);
    click(toMins); // the browser follows a press with a click
  }

  it('opens the panel on release with the dragged start and end, and keeps a block on the Timeline', () => {
    mount();

    drag(60, 90);

    expect(openNewEntry).toHaveBeenCalledOnce();
    expect(openNewEntry).toHaveBeenCalledWith(60, 100);
    expect(preview()).not.toBeNull();
    const { position, size } = layout.previewRect;
    const pxPerMinute = el.getPxPerMinute();
    expect(Number(preview().getAttribute(position))).toBe(60 * pxPerMinute);
    expect(Number(preview().getAttribute(size))).toBe(40 * pxPerMinute);
  });

  it('shows the block growing while the pointer is still down, before the panel opens', () => {
    mount();

    fire('pointerdown', 60);
    fire('pointermove', 80);

    expect(preview()).not.toBeNull();
    expect(openNewEntry).not.toHaveBeenCalled();
    expect(el.querySelector('[data-part="create-preview"] text').textContent).toMatch(/–/);
  });

  it('does not also make a plain-click block from the click that ends the drag', () => {
    mount();

    drag(60, 90);

    expect(openNewEntry).toHaveBeenCalledOnce(); // not twice
  });

  it('makes a 30-minute block, and opens the panel, for a plain click', () => {
    mount();

    fire('pointerdown', 60);
    fire('pointerup', 60);
    click(60);

    expect(openNewEntry).toHaveBeenCalledOnce();
    expect(openNewEntry).toHaveBeenCalledWith(60, 90);
    expect(preview()).not.toBeNull();
  });

  it('shortens a plain-click block to the free time before the next Entry', () => {
    mount(PRIMARY, [{ startOffsetMins: 80, endOffsetMins: 120, activity: 'Sleep' }]);

    click(60);

    expect(openNewEntry).toHaveBeenCalledWith(60, 80);
  });

  it('stops a dragged block at the next Entry on a single-choice Dimension', () => {
    mount(PRIMARY, [{ startOffsetMins: 100, endOffsetMins: 140, activity: 'Sleep' }]);

    drag(60, 200);

    expect(openNewEntry).toHaveBeenCalledWith(60, 100);
  });

  it('lets a block overlap a neighbour on a multiple-choice Dimension', () => {
    mount(WHO, [{ startOffsetMins: 100, endOffsetMins: 140, activity: 'Alone' }]);

    drag(60, 200);

    expect(openNewEntry).toHaveBeenCalledWith(60, 210);
  });

  it('flashes "No room here", and opens nothing, for a click on a covered slot', () => {
    mount(PRIMARY, [{ startOffsetMins: 60, endOffsetMins: 120, activity: 'Sleep' }]);

    // a covered slot is a click on the Entry in the browser; here the zone is
    // hit directly, as it would be through a gap in the rendering
    click(80);

    expect(openNewEntry).not.toHaveBeenCalled();
    expect(el.querySelector('[data-part="create-preview"] text').textContent).toBe('No room here');
  });

  it('creates nothing, and leaves no block, when Escape cancels the drag', () => {
    mount();

    fire('pointerdown', 60);
    fire('pointermove', 90);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fire('pointerup', 90);
    click(90);

    expect(openNewEntry).not.toHaveBeenCalled();
    expect(preview()).toBeNull();
  });

  it('creates nothing when the pointer is cancelled', () => {
    mount();

    fire('pointerdown', 60);
    fire('pointermove', 90);
    fire('pointercancel', 90);

    expect(openNewEntry).not.toHaveBeenCalled();
    expect(preview()).toBeNull();
  });

  it('removes the block when the panel closes without saving', () => {
    mount();
    drag(60, 90);
    expect(preview()).not.toBeNull();

    appStore.dispatch({ type: HIDE_PANEL });

    expect(preview()).toBeNull();
  });

  it('removes the block when the Respondent moves to another Dimension', () => {
    mount();
    drag(60, 90);

    appStore.dispatch({ type: SWITCH_DIMENSION, payload: WHO });

    expect(preview()).toBeNull();
  });

  it('removes the block when an existing Entry is opened instead', () => {
    mount(PRIMARY, [{ id: 7, startOffsetMins: 200, endOffsetMins: 240, activity: 'Sleep' }]);
    const openEntry = vi.fn();
    el.panelActions.openEntry = openEntry;
    drag(60, 90);

    el.onTimelineClick({ target: { dataset: { id: '7' } } });

    expect(openEntry).toHaveBeenCalled();
    expect(preview()).toBeNull();
  });

  it('does not take a press on an Entry for the start of a new one', () => {
    mount(PRIMARY, [{ id: 7, startOffsetMins: 60, endOffsetMins: 120, activity: 'Sleep' }]);
    const entryRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    entryRect.dataset.id = '7';
    el.entriesLayer.appendChild(entryRect);

    for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, { pointerId: 1, pointerType: 'mouse', button: 0, ...layout.at(90, el) });
      entryRect.dispatchEvent(event);
    }

    expect(openNewEntry).not.toHaveBeenCalled();
    expect(preview()).toBeNull();
  });

  describe('adjusting the provisional block while the panel is open', () => {
    const { position, size } = layout.previewRect;
    const previewSpan = () => ({
      start: Number(preview().getAttribute(position)) / el.getPxPerMinute(),
      end:
        (Number(preview().getAttribute(position)) + Number(preview().getAttribute(size))) /
        el.getPxPerMinute(),
    });
    const handle = (edge) => el.querySelector(`.resize-handle[data-handle-edge="${edge}"]`);

    // press on a handle, move, release - the pointer stays captured by the handle
    function dragHandle(edge, toMins) {
      const target = handle(edge).querySelector('circle');
      const press = new Event('pointerdown', { bubbles: true, cancelable: true });
      Object.assign(press, { pointerId: 1, pointerType: 'mouse', button: 0, ...layout.at(0, el) });
      target.dispatchEvent(press);
      fire('pointermove', toMins);
      fire('pointerup', toMins);
      // the browser follows the press with a click on the captured handle
      handle(edge)
        .querySelector('circle')
        .dispatchEvent(new MouseEvent('click', { bubbles: true, ...layout.at(toMins, el) }));
    }

    beforeEach(() => {
      mount();
      el.panelActions.setNewEntryTimes = vi.fn();
      drag(60, 90); // 60-100
    });

    it('shows a start and an end handle on the block', () => {
      expect(el.querySelectorAll('.resize-handle')).toHaveLength(2);
      expect(handle('start').dataset.handleEntryId).toBe('-1');
    });

    it('keeps both edges when the start is dragged earlier and then the end later', () => {
      dragHandle('start', 30);
      expect(previewSpan()).toEqual({ start: 30, end: 100 });
      dragHandle('end', 150);

      expect(previewSpan()).toEqual({ start: 30, end: 150 });
      expect(el.panelActions.setNewEntryTimes).toHaveBeenLastCalledWith(30, 150);
      expect(openNewEntry).toHaveBeenCalledOnce(); // never replaced by a fresh block
    });

    it('moves the block by its body, keeping its length', () => {
      fire('pointerdown', 70);
      fire('pointermove', 110);
      fire('pointerup', 110);
      click(110);

      expect(previewSpan()).toEqual({ start: 100, end: 140 });
      expect(el.panelActions.setNewEntryTimes).toHaveBeenLastCalledWith(100, 140);
      expect(openNewEntry).toHaveBeenCalledOnce();
    });

    it('leaves the block as it is for a plain click on it', () => {
      fire('pointerdown', 70);
      fire('pointerup', 70);
      click(70);

      expect(previewSpan()).toEqual({ start: 60, end: 100 });
      expect(openNewEntry).toHaveBeenCalledOnce();
    });

    it('paints a fresh block for a press on empty time away from it', () => {
      drag(300, 320);

      expect(openNewEntry).toHaveBeenCalledTimes(2);
      expect(openNewEntry).toHaveBeenLastCalledWith(300, 330);
      expect(previewSpan()).toEqual({ start: 300, end: 330 });
      expect(el.querySelectorAll('.resize-handle')).toHaveLength(2);
    });

    it('puts the block back when Escape cancels a handle drag', () => {
      const target = handle('end').querySelector('circle');
      const press = new Event('pointerdown', { bubbles: true, cancelable: true });
      Object.assign(press, { pointerId: 1, pointerType: 'mouse', button: 0 });
      target.dispatchEvent(press);
      fire('pointermove', 200);
      expect(previewSpan().end).toBe(200);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(previewSpan()).toEqual({ start: 60, end: 100 });
      expect(el.panelActions.setNewEntryTimes).not.toHaveBeenCalled();
    });

    it('follows the panel time fields', () => {
      el.syncDraftFromPanel(120, 200);

      expect(previewSpan()).toEqual({ start: 120, end: 200 });
      el.syncDraftFromPanel(200, 200); // not a block: ignored
      expect(previewSpan()).toEqual({ start: 120, end: 200 });
    });

    it('takes its handles away with the block when the panel closes', () => {
      appStore.dispatch({ type: HIDE_PANEL });

      expect(preview()).toBeNull();
      expect(el.querySelectorAll('.resize-handle')).toHaveLength(0);
    });
  });

  it('stops a dragged provisional block at a neighbour, leaving the neighbour alone', () => {
    mount(PRIMARY, [{ id: 7, startOffsetMins: 120, endOffsetMins: 160, activity: 'Sleep' }]);
    drag(60, 90); // 60-100
    const target = el.querySelector('.resize-handle[data-handle-edge="end"] circle');
    const press = new Event('pointerdown', { bubbles: true, cancelable: true });
    Object.assign(press, { pointerId: 1, pointerType: 'mouse', button: 0 });
    target.dispatchEvent(press);
    fire('pointermove', 300);
    fire('pointerup', 300);

    const rect = el.querySelector('[data-part="create-preview"] rect');
    const end =
      (Number(rect.getAttribute(layout.previewRect.position)) +
        Number(rect.getAttribute(layout.previewRect.size))) /
      el.getPxPerMinute();
    expect(end).toBe(120);
    expect(appStore.getState().diaries[PAST_DATE].timelines[PRIMARY][0]).toMatchObject({
      startOffsetMins: 120,
      endOffsetMins: 160,
    });
  });
});
