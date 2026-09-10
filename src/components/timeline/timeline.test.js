import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Timeline } from './timeline';
// Timeline only references '<el-details-panel>' as a string in its render
// template - it never imports the class, so DetailsPanel is only ever
// registered as a customElements side effect of *something* importing it.
// Pull that in explicitly so the panelActions contract can actually wire up.
import '../detailsPanel/detailsPanel';
import { appStore } from '../../store/appStore';
import {
  ADD_ENTRY,
  UPDATE_ENTRY,
  SWITCH_DATE,
  SHOW_PANEL,
  HIDE_PANEL,
} from '../../store/actionTypes';
import { getCurrentDiaryDateKey, getCurrentOffsetMins } from '../../utils/time';

// renderEntriesInto is the renderer shared by renderEntries() and
// renderShadowDimension() (previously ~45 lines duplicated between them,
// differing only in width/x-offset/target-layer). It doesn't touch `this`,
// so it can be called directly off the prototype without constructing a
// full Timeline instance (which requires the #svg-timeline <template> from
// index.html to exist in the document).
const renderEntriesInto = Timeline.prototype.renderEntriesInto;

function createSvgLayer() {
  return document.createElementNS('http://www.w3.org/2000/svg', 'g');
}

describe('Timeline.renderEntriesInto', () => {
  it('renders one <g> per entry with a positioned rect and a labelled foreignObject', () => {
    const layer = createSvgLayer();
    const entries = [{ id: 1, startOffsetMins: 60, endOffsetMins: 90, activity: 'Sleep' }];

    renderEntriesInto({
      layer,
      entries,
      dimensionIndex: 0,
      blockWidth: '220',
      labelX: 110,
      labelWidth: 200,
    });

    const group = layer.querySelector('g');
    expect(group).not.toBeNull();

    const rect = group.querySelector('rect');
    expect(rect.getAttribute('x')).toBe('100');
    expect(rect.getAttribute('y')).toBe('120'); // 60min * 2px/min
    expect(rect.getAttribute('height')).toBe('60'); // (90-60)min * 2px/min
    expect(rect.getAttribute('width')).toBe('220');
    expect(rect.getAttribute('data-id')).toBe('1');

    const foreignObject = group.querySelector('foreignObject');
    expect(foreignObject.getAttribute('x')).toBe('110');
    expect(foreignObject.getAttribute('width')).toBe('200');
    expect(foreignObject.querySelector('.event-label').textContent).toBe('Sleep');
  });

  // pixel-identical to the pre-refactor renderShadowDimension() output
  it('renders a narrower block using the shadow-dimension parameters', () => {
    const layer = createSvgLayer();
    const entries = [{ id: 2, startOffsetMins: 0, endOffsetMins: 30, activity: 'Wake up' }];

    renderEntriesInto({
      layer,
      entries,
      dimensionIndex: 0,
      blockWidth: '50',
      labelX: 100,
      labelWidth: 50,
    });

    const rect = layer.querySelector('rect');
    expect(rect.getAttribute('width')).toBe('50');
    const foreignObject = layer.querySelector('foreignObject');
    expect(foreignObject.getAttribute('x')).toBe('100');
    expect(foreignObject.getAttribute('width')).toBe('50');
  });

  it('clears the layer before rendering, leaving no stale entries behind', () => {
    const layer = createSvgLayer();
    layer.innerHTML = '<g data-stale="true"></g>';

    renderEntriesInto({
      layer,
      entries: [],
      dimensionIndex: 0,
      blockWidth: '220',
      labelX: 110,
      labelWidth: 200,
    });

    expect(layer.querySelector('[data-stale]')).toBeNull();
  });

  it('joins a multiple-choice (array) activity into a comma-separated label', () => {
    const layer = createSvgLayer();
    const entries = [
      { id: 3, startOffsetMins: 0, endOffsetMins: 10, activity: ['Cooking', 'Childcare'] },
    ];

    renderEntriesInto({
      layer,
      entries,
      dimensionIndex: 0,
      blockWidth: '220',
      labelX: 110,
      labelWidth: 200,
    });

    expect(layer.querySelector('.event-label').textContent).toBe('Cooking, Childcare');
  });
});

// regression coverage for the Timeline -> DetailsPanel props-based contract:
// Timeline used to hold a raw `this.detailsPanel` DOM reference and call
// setStartTime/setEndTime/setActivity/setEntryId/reset/showError on it
// directly - any rename on DetailsPanel's side would silently break
// Timeline. It now only knows about the four functions DetailsPanel hands
// back via the registerPanelActions callback prop.
describe('Timeline panelActions contract', () => {
  beforeEach(() => {
    if (!customElements.get('el-timeline')) {
      customElements.define('el-timeline', Timeline);
    }
    if (!document.getElementById('svg-timeline')) {
      const template = document.createElement('template');
      template.id = 'svg-timeline';
      template.innerHTML = `
        <svg>
          <g id="timeline-shadow"></g>
          <rect id="future-overlay"></rect>
          <g id="events"></g>
        </svg>
      `;
      document.head.appendChild(template);
    }
    document.body.innerHTML = '';
  });

  function createTimeline(dimensionIndex) {
    const el = document.createElement('el-timeline');
    el.setAttribute('index', String(dimensionIndex));
    document.body.appendChild(el);
    return el;
  }

  it('does not hold a direct reference to the details panel instance', () => {
    const el = createTimeline(2); // Location
    expect(el.detailsPanel).toBeUndefined();
    expect(el.panelActions).toBeDefined();
  });

  it('calls panelActions.openNewEntry (not a direct method call) when clicking the gridline zone', () => {
    const el = createTimeline(4); // Device
    const openNewEntry = vi.fn();
    el.panelActions.openNewEntry = openNewEntry;

    // clientYToSvgY falls back to raw clientY in this test environment
    // (no SVG geometry APIs), same as the real getScreenCTM path would
    // resolve to for a click 40px into an unscaled SVG
    el.onTimelineClick({ target: { id: 'gridline_zone', dataset: {} }, clientX: 0, clientY: 40 });

    expect(openNewEntry).toHaveBeenCalledWith(20); // calculateTheTimeSlotClicked(40) -> 20
  });

  // regression coverage: found on a real device (Chrome, not Firefox, same
  // device) - creating an entry at a visual 12:00 opened the panel at
  // 11:00. Root cause: raw offsetY assumes 1 CSS px === 1 viewBox unit,
  // which breaks once the SVG's rendered width (100vw) comes out narrower
  // than its 375-unit viewBox - preserveAspectRatio then uniformly shrinks
  // the whole coordinate system, time axis included, to fit. The error
  // grows with distance down the day, which is what pointed at a scale
  // mismatch rather than a fixed offset.
  it('accounts for the SVG rendering at a smaller scale than its viewBox, not just raw offsetY', () => {
    const el = createTimeline(4); // Device
    const openNewEntry = vi.fn();
    el.panelActions.openNewEntry = openNewEntry;
    const svg = el.timeLineElement;

    // simulate the SVG rendering at 87.5% of its viewBox size, matching
    // what was actually measured on the real device
    const SCALE = 0.875;
    svg.createSVGPoint = () => ({
      x: 0,
      y: 0,
      matrixTransform(matrix) {
        return { x: this.x * matrix.a, y: this.y * matrix.d };
      },
    });
    svg.getScreenCTM = () => ({ inverse: () => ({ a: 1 / SCALE, d: 1 / SCALE }) });

    el.onTimelineClick({ target: { id: 'gridline_zone', dataset: {} }, clientX: 0, clientY: 850 });

    // 850 rendered px, unscaled to ~971 viewBox units -> 12:00 (480min).
    // Raw offsetY would have given floor(850/20)*10 = 420min -> 11:00.
    expect(openNewEntry).toHaveBeenCalledWith(480);
  });

  // regression coverage: only a click that actually lands on the gridline
  // zone creates a new entry - any other empty-space click (e.g. one meant
  // to dismiss visible drag handles) is a no-op, rather than being read as
  // "create an entry" the way any non-entry click used to be
  it('does not call panelActions.openNewEntry when an empty-space click lands outside the gridline zone', () => {
    const el = createTimeline(4); // Device
    const openNewEntry = vi.fn();
    el.panelActions.openNewEntry = openNewEntry;

    el.onTimelineClick({ target: { dataset: {} }, offsetY: 40 }); // no id at all
    el.onTimelineClick({ target: { id: 'hour-labels', dataset: {} }, offsetY: 40 });

    expect(openNewEntry).not.toHaveBeenCalled();
  });

  it('calls panelActions.openEntry with the clicked entry when clicking an existing block', () => {
    const el = createTimeline(1); // Secondary activity
    const entry = { id: 7, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    el.entries = [entry];
    const openEntry = vi.fn();
    el.panelActions.openEntry = openEntry;

    el.onTimelineClick({ target: { dataset: { id: '7' } } });

    expect(openEntry).toHaveBeenCalledWith(entry);
  });

  it('calls panelActions.close after saving successfully', () => {
    const el = createTimeline(5); // Enjoyment (single-choice)
    const close = vi.fn();
    el.panelActions.close = close;

    el.saveEntry({ startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' });

    expect(close).toHaveBeenCalledOnce();
  });

  it('calls panelActions.reportSaveConflict instead of close when the new entry overlaps an existing one', () => {
    const el = createTimeline(0); // Primary activity (single-choice)
    el.entries = [{ id: 1, startOffsetMins: 0, endOffsetMins: 60, activity: 'Sleep' }];
    const close = vi.fn();
    const reportSaveConflict = vi.fn();
    el.panelActions.close = close;
    el.panelActions.reportSaveConflict = reportSaveConflict;

    el.saveEntry({ startOffsetMins: 30, endOffsetMins: 90, activity: 'Work' });

    expect(reportSaveConflict).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });
});

// Phase 1 of the drag-handle resize feature (see plans/drag-handle-resize.md):
// long-pressing an entry reveals resize handles, without dragging them yet.
describe('Timeline long-press resize handles', () => {
  beforeEach(() => {
    if (!customElements.get('el-timeline')) {
      customElements.define('el-timeline', Timeline);
    }
    if (!document.getElementById('svg-timeline')) {
      const template = document.createElement('template');
      template.id = 'svg-timeline';
      template.innerHTML = `
        <svg>
          <g id="timeline-shadow"></g>
          <rect id="future-overlay"></rect>
          <g id="events"></g>
        </svg>
      `;
      document.head.appendChild(template);
    }
    document.body.innerHTML = '';
    appStore.dispatch({ type: HIDE_PANEL });
    // a fixed past date, not "today" - these tests aren't about the Phase 3
    // "can't drag past now" restriction, so keep them clear of it regardless
    // of the real wall-clock time whenever the suite happens to run
    appStore.dispatch({ type: SWITCH_DATE, payload: '2020-01-01' });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    appStore.dispatch({ type: HIDE_PANEL });
  });

  function createTimeline(dimensionIndex, entries) {
    const el = document.createElement('el-timeline');
    el.setAttribute('index', String(dimensionIndex));
    document.body.appendChild(el);
    el.entries = entries;
    el.renderEntries();
    return el;
  }

  function pointerDownOn(rect, overrides = {}) {
    return {
      target: rect,
      pointerId: 1,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
      ...overrides,
    };
  }

  it('reveals a top and bottom handle after holding on an entry past the long-press threshold', () => {
    const entry = { id: 1, startOffsetMins: 60, endOffsetMins: 90, activity: 'Reading' };
    const el = createTimeline(2, [entry]); // Location
    const rect = el.querySelector('#events rect[data-id="1"]');

    el.onEntryPointerDown(pointerDownOn(rect));
    vi.advanceTimersByTime(500);

    expect(el.activeHandleEntryId).toBe(1);
    const handles = el.querySelectorAll('#drag-handles .resize-handle');
    expect(handles).toHaveLength(2);
    expect([...handles].map((h) => h.dataset.handleEdge).sort()).toEqual(['end', 'start']);
  });

  it('sizes each handle a generous hit target independent of its visible grip', () => {
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const rect = el.querySelector('#events rect[data-id="1"]');

    el.onEntryPointerDown(pointerDownOn(rect));
    vi.advanceTimersByTime(500);

    const hitArea = el.querySelector('#drag-handles .resize-handle-hit-area');
    const grip = el.querySelector('#drag-handles .resize-handle-grip');
    expect(Number(hitArea.getAttribute('r'))).toBeGreaterThan(Number(grip.getAttribute('r')));
  });

  it('cancels the pending long-press if the pointer moves too far before the hold completes', () => {
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const rect = el.querySelector('#events rect[data-id="1"]');

    el.onEntryPointerDown(pointerDownOn(rect));
    el.onEntryPointerMove(pointerDownOn(rect, { clientX: 40, clientY: 0 }));
    vi.advanceTimersByTime(500);

    expect(el.activeHandleEntryId).toBeUndefined();
    expect(el.querySelectorAll('#drag-handles .resize-handle')).toHaveLength(0);
  });

  it('never arms a long-press for an entry on the read-only Primary activity mirror strip', () => {
    const el = createTimeline(2, []); // Location - a non-primary dimension
    Timeline.prototype.renderEntriesInto.call(el, {
      layer: el.shadowEntriesLayer,
      entries: [{ id: 9, startOffsetMins: 0, endOffsetMins: 30, activity: 'Sleep' }],
      dimensionIndex: 0,
      blockWidth: '50',
      labelX: 100,
      labelWidth: 50,
    });
    const shadowRect = el.querySelector('#timeline-shadow rect[data-id="9"]');

    el.onEntryPointerDown(pointerDownOn(shadowRect));
    vi.advanceTimersByTime(500);

    expect(el.activeHandleEntryId).toBeUndefined();
  });

  it('does not arm a long-press while the details panel is open', () => {
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const rect = el.querySelector('#events rect[data-id="1"]');
    appStore.dispatch({ type: SHOW_PANEL, payload: 'activity' });

    el.onEntryPointerDown(pointerDownOn(rect));
    vi.advanceTimersByTime(500);

    expect(el.activeHandleEntryId).toBeUndefined();
  });

  it('swallows the click that follows a fired long-press, so it does not also open the details panel', () => {
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const rect = el.querySelector('#events rect[data-id="1"]');
    const openEntry = vi.fn();
    el.panelActions.openEntry = openEntry;

    el.onEntryPointerDown(pointerDownOn(rect));
    vi.advanceTimersByTime(500);
    el.onTimelineClick({ target: rect });

    expect(openEntry).not.toHaveBeenCalled();
    expect(el.activeHandleEntryId).toBe(1); // handles stay up - the swallowed click didn't dismiss them
  });

  it('clears the swallow-next-click flag on pointerup even if the click never arrives, so it cannot swallow a later, unrelated click', () => {
    const entryA = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const entryB = { id: 2, startOffsetMins: 30, endOffsetMins: 60, activity: 'Walking' };
    const el = createTimeline(2, [entryA, entryB]);
    const rectA = el.querySelector('#events rect[data-id="1"]');
    const rectB = el.querySelector('#events rect[data-id="2"]');
    const openEntry = vi.fn();
    el.panelActions.openEntry = openEntry;

    el.onEntryPointerDown(pointerDownOn(rectA, { pointerId: 1 }));
    vi.advanceTimersByTime(500);
    expect(el.activeHandleEntryId).toBe(1);
    // pointerup fires (as it always does), but - unlike a real browser -
    // no trailing 'click' follows it here
    el.timeLineElement.dispatchEvent(new Event('pointerup'));
    vi.advanceTimersByTime(0); // the fallback clear is scheduled via setTimeout(0)

    el.onTimelineClick({ target: rectB }); // an unrelated later click

    expect(openEntry).toHaveBeenCalledWith(entryB);
  });

  it('dismisses visible handles when a subsequent real click lands elsewhere on the timeline', () => {
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const rect = el.querySelector('#events rect[data-id="1"]');
    el.onEntryPointerDown(pointerDownOn(rect));
    vi.advanceTimersByTime(500);
    el.onTimelineClick({ target: rect }); // the click the long-press's own release also fires - swallowed
    expect(el.activeHandleEntryId).toBe(1);

    el.onTimelineClick({ target: { dataset: {} }, offsetY: 10 }); // a separate, later click elsewhere

    expect(el.activeHandleEntryId).toBeUndefined();
    expect(el.querySelectorAll('#drag-handles .resize-handle')).toHaveLength(0);
  });

  it('dismisses visible, idle handles when Escape is pressed', () => {
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const rect = el.querySelector('#events rect[data-id="1"]');
    el.onEntryPointerDown(pointerDownOn(rect));
    vi.advanceTimersByTime(500);
    expect(el.activeHandleEntryId).toBe(1);

    el.onGlobalKeyDown({ key: 'Escape' });

    expect(el.activeHandleEntryId).toBeUndefined();
    expect(el.querySelectorAll('#drag-handles .resize-handle')).toHaveLength(0);
  });

  it('hides handles when the entry they belong to is deleted', () => {
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const rect = el.querySelector('#events rect[data-id="1"]');
    el.onEntryPointerDown(pointerDownOn(rect));
    vi.advanceTimersByTime(500);
    expect(el.activeHandleEntryId).toBe(1);

    el.deleteEntry(1);

    expect(el.activeHandleEntryId).toBeUndefined();
  });
});

// Phase 2 of the drag-handle resize feature (see plans/drag-handle-resize.md):
// dragging an already-visible handle live-resizes the entry, snapped to the
// 10-minute grid, and commits (or reverts) on release/cancel.
describe('Timeline drag-to-resize handles', () => {
  beforeEach(() => {
    if (!customElements.get('el-timeline')) {
      customElements.define('el-timeline', Timeline);
    }
    if (!document.getElementById('svg-timeline')) {
      const template = document.createElement('template');
      template.id = 'svg-timeline';
      template.innerHTML = `
        <svg>
          <g id="timeline-shadow"></g>
          <rect id="future-overlay"></rect>
          <g id="events"></g>
        </svg>
      `;
      document.head.appendChild(template);
    }
    document.body.innerHTML = '';
    appStore.dispatch({ type: HIDE_PANEL });
    // a fixed past date - see the identical note in the Phase 1 describe
    // block above; these tests aren't about the Phase 3 "now" restriction
    appStore.dispatch({ type: SWITCH_DATE, payload: '2020-01-01' });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks(); // dispatch is spied on per-test - each test needs its own clean call history
    appStore.dispatch({ type: HIDE_PANEL });
  });

  function createTimeline(dimensionIndex, entries) {
    const el = document.createElement('el-timeline');
    el.setAttribute('index', String(dimensionIndex));
    document.body.appendChild(el);
    el.entries = entries;
    el.renderEntries();
    return el;
  }

  // long-presses entry `id` to reveal its handles (Phase 1), returning the
  // hit-area element for the requested edge so a drag can start on it
  function revealHandle(el, entryId, edge) {
    const rect = el.querySelector(`#events rect[data-id="${entryId}"]`);
    el.onEntryPointerDown({
      target: rect,
      pointerId: 1,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    vi.advanceTimersByTime(500);
    return el.querySelector(
      `#drag-handles .resize-handle[data-handle-edge="${edge}"] .resize-handle-hit-area`
    );
  }

  it('drags the bottom handle to live-resize the entry, snapped to the 10-minute grid', () => {
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const hitArea = revealHandle(el, 1, 'end');

    el.onEntryPointerDown({
      target: hitArea,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: hitArea, pointerId: 2, clientX: 0, clientY: 103 }); // -> snaps to 50min

    expect(el.activeDrag).toMatchObject({
      entryId: 1,
      edge: 'end',
      currentStart: 0,
      currentEnd: 50,
    });
    const rect = el.querySelector('#events rect[data-id="1"]');
    expect(rect.getAttribute('y')).toBe('0'); // start edge unmoved
    expect(rect.getAttribute('height')).toBe('100'); // (50-0)min * 2px/min
    const readout = el.querySelector('#drag-handles .resize-handle-readout');
    expect(readout).not.toBeNull();
  });

  it('drags the top handle to live-resize the entry, keeping the end fixed', () => {
    const entry = { id: 1, startOffsetMins: 30, endOffsetMins: 90, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const hitArea = revealHandle(el, 1, 'start');

    el.onEntryPointerDown({
      target: hitArea,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: hitArea, pointerId: 2, clientX: 0, clientY: 41 }); // -> snaps to 20min

    expect(el.activeDrag).toMatchObject({
      entryId: 1,
      edge: 'start',
      currentStart: 20,
      currentEnd: 90,
    });
    const rect = el.querySelector('#events rect[data-id="1"]');
    expect(rect.getAttribute('y')).toBe('40'); // 20min * 2px/min
    expect(rect.getAttribute('height')).toBe('140'); // (90-20)min * 2px/min
  });

  it('commits exactly one UPDATE_ENTRY dispatch on release, and leaves handles up and re-draggable', () => {
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const hitArea = revealHandle(el, 1, 'end');
    const dispatchSpy = vi.spyOn(el.store, 'dispatch');

    el.onEntryPointerDown({
      target: hitArea,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: hitArea, pointerId: 2, clientX: 0, clientY: 103 }); // -> 50min
    el.commitDrag();

    const updateCalls = dispatchSpy.mock.calls.filter(([action]) => action.type === UPDATE_ENTRY);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0][0].payload).toMatchObject({
      id: 1,
      startOffsetMins: 0,
      endOffsetMins: 50,
    });
    expect(el.activeDrag).toBeUndefined();
    expect(el.activeHandleEntryId).toBe(1); // still up, re-draggable
    expect(el.querySelectorAll('#drag-handles .resize-handle')).toHaveLength(2);
  });

  it('reverts to the pre-drag start/end and dispatches nothing when the pointer is cancelled mid-drag', () => {
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const hitArea = revealHandle(el, 1, 'end');
    const dispatchSpy = vi.spyOn(el.store, 'dispatch');

    el.onEntryPointerDown({
      target: hitArea,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: hitArea, pointerId: 2, clientX: 0, clientY: 103 }); // -> 50min
    el.cancelDrag();

    expect(dispatchSpy.mock.calls.some(([action]) => action.type === UPDATE_ENTRY)).toBe(false);
    expect(el.activeDrag).toBeUndefined();
    const rect = el.querySelector('#events rect[data-id="1"]');
    expect(rect.getAttribute('height')).toBe('60'); // reverted to (30-0)min * 2px/min
    expect(el.activeHandleEntryId).toBe(1); // handles stay up at the reverted position
  });

  it('reverts an in-progress drag and dispatches nothing when Escape is pressed mid-drag', () => {
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const hitArea = revealHandle(el, 1, 'end');
    const dispatchSpy = vi.spyOn(el.store, 'dispatch');

    el.onEntryPointerDown({
      target: hitArea,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: hitArea, pointerId: 2, clientX: 0, clientY: 103 });

    el.onGlobalKeyDown({ key: 'Escape' });

    expect(dispatchSpy.mock.calls.some(([action]) => action.type === UPDATE_ENTRY)).toBe(false);
    expect(el.activeDrag).toBeUndefined();
    const rect = el.querySelector('#events rect[data-id="1"]');
    expect(rect.getAttribute('height')).toBe('60');
  });

  it('does not treat a click landing on a handle as a normal timeline click', () => {
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const hitArea = revealHandle(el, 1, 'end');
    const openEntry = vi.fn();
    const openNewEntry = vi.fn();
    el.panelActions.openEntry = openEntry;
    el.panelActions.openNewEntry = openNewEntry;

    el.onTimelineClick({ target: hitArea });

    expect(openEntry).not.toHaveBeenCalled();
    expect(openNewEntry).not.toHaveBeenCalled();
    expect(el.activeHandleEntryId).toBe(1); // unaffected - handles stay up
  });

  // regression coverage: touch dragging a handle was scrolling the
  // timeline's scrollable ancestor (see timelineStack.css's overflow-y:
  // auto) instead of just resizing the entry, because SVG shape elements
  // have unreliable touch-action support on their own in some browsers -
  // fixed with both a touch-action:none class on the SVG itself for the
  // duration of the drag, and a belt-and-braces preventDefault() on each
  // pointermove while dragging
  it('marks the SVG as dragging (touch-action:none) for the duration of a drag, clearing it on commit', () => {
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const hitArea = revealHandle(el, 1, 'end');
    expect(el.timeLineElement.classList.contains('dragging-handle')).toBe(false);

    el.onEntryPointerDown({
      target: hitArea,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    expect(el.timeLineElement.classList.contains('dragging-handle')).toBe(true);

    el.onEntryPointerMove({ target: hitArea, pointerId: 2, clientX: 0, clientY: 103 });
    expect(el.timeLineElement.classList.contains('dragging-handle')).toBe(true);

    el.commitDrag();
    expect(el.timeLineElement.classList.contains('dragging-handle')).toBe(false);
  });

  it('clears the dragging SVG class when a drag is cancelled instead of committed', () => {
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const hitArea = revealHandle(el, 1, 'end');

    el.onEntryPointerDown({
      target: hitArea,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.cancelDrag();

    expect(el.timeLineElement.classList.contains('dragging-handle')).toBe(false);
  });

  it('prevents the default action on pointermove events during an active drag, to stop the timeline from scrolling under a touch drag', () => {
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const hitArea = revealHandle(el, 1, 'end');
    el.onEntryPointerDown({
      target: hitArea,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    const preventDefault = vi.fn();

    el.onEntryPointerMove({
      target: hitArea,
      pointerId: 2,
      clientX: 0,
      clientY: 103,
      preventDefault,
    });

    expect(preventDefault).toHaveBeenCalledOnce();
  });
});

// Phase 3 of the drag-handle resize feature (see plans/drag-handle-resize.md):
// hard limits on an in-progress drag - minimum duration, single-choice
// neighbor collision, the diary day's own bounds, and "now" for today.
describe('Timeline drag hard limits', () => {
  beforeEach(() => {
    if (!customElements.get('el-timeline')) {
      customElements.define('el-timeline', Timeline);
    }
    if (!document.getElementById('svg-timeline')) {
      const template = document.createElement('template');
      template.id = 'svg-timeline';
      template.innerHTML = `
        <svg>
          <g id="timeline-shadow"></g>
          <rect id="future-overlay"></rect>
          <g id="events"></g>
        </svg>
      `;
      document.head.appendChild(template);
    }
    document.body.innerHTML = '';
    appStore.dispatch({ type: HIDE_PANEL });
    // a fixed past date by default - individual tests switch to today where
    // the "now" limit is specifically what's under test
    appStore.dispatch({ type: SWITCH_DATE, payload: '2020-01-01' });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    appStore.dispatch({ type: HIDE_PANEL });
  });

  function createTimeline(dimensionIndex, entries) {
    const el = document.createElement('el-timeline');
    el.setAttribute('index', String(dimensionIndex));
    document.body.appendChild(el);
    el.entries = entries;
    el.renderEntries();
    return el;
  }

  function revealHandle(el, entryId, edge) {
    const rect = el.querySelector(`#events rect[data-id="${entryId}"]`);
    el.onEntryPointerDown({
      target: rect,
      pointerId: 1,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    vi.advanceTimersByTime(500);
    return el.querySelector(
      `#drag-handles .resize-handle[data-handle-edge="${edge}"] .resize-handle-hit-area`
    );
  }

  it('clamps a drag so the entry cannot be resized shorter than the 10-minute minimum, and flashes the limit cue', () => {
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const el = createTimeline(2, [entry]); // Location - single-choice, no neighbors
    const hitArea = revealHandle(el, 1, 'start');

    el.onEntryPointerDown({
      target: hitArea,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: hitArea, pointerId: 2, clientX: 0, clientY: 65 }); // raw snap -> 30min, past the 20min ceiling

    expect(el.activeDrag.currentStart).toBe(20); // clamped to end(30) - 10min minimum
    const rect = el.querySelector('#events rect[data-id="1"]');
    expect(rect.classList.contains('resize-limit-flash')).toBe(true);
  });

  it('flashes the limit cue once per approach, not on every tick still pressed against the same wall', () => {
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const hitArea = revealHandle(el, 1, 'start');
    const flashSpy = vi.spyOn(el, 'flashLimitCue');

    el.onEntryPointerDown({
      target: hitArea,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: hitArea, pointerId: 2, clientX: 0, clientY: 65 });
    el.onEntryPointerMove({ target: hitArea, pointerId: 2, clientX: 0, clientY: 70 }); // still past the same limit

    expect(flashSpy).toHaveBeenCalledTimes(1);
  });

  it('in a single-choice dimension, clamps a drag at the boundary of the adjacent entry, and flashes the limit cue', () => {
    const entryA = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Reading' };
    const entryB = { id: 2, startOffsetMins: 60, endOffsetMins: 90, activity: 'Walking' };
    const el = createTimeline(2, [entryA, entryB]); // Location - single-choice
    const hitArea = revealHandle(el, 1, 'end');

    el.onEntryPointerDown({
      target: hitArea,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: hitArea, pointerId: 2, clientX: 0, clientY: 200 }); // raw snap -> 100min, past entryB's start

    expect(el.activeDrag.currentEnd).toBe(60); // clamped to entryB's start
    const rect = el.querySelector('#events rect[data-id="1"]');
    expect(rect.classList.contains('resize-limit-flash')).toBe(true);
  });

  it('in a multiple-choice dimension, permits dragging past an adjacent entry boundary without stopping or flashing', () => {
    const entryA = { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: ['Partner'] };
    const entryB = { id: 2, startOffsetMins: 60, endOffsetMins: 90, activity: ['Friends'] };
    const el = createTimeline(3, [entryA, entryB]); // Who - multiple-choice
    const hitArea = revealHandle(el, 1, 'end');

    el.onEntryPointerDown({
      target: hitArea,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: hitArea, pointerId: 2, clientX: 0, clientY: 200 }); // -> 100min, past entryB's start

    expect(el.activeDrag.currentEnd).toBe(100); // not stopped by the neighbor
    const rect = el.querySelector('#events rect[data-id="1"]');
    expect(rect.classList.contains('resize-limit-flash')).toBe(false);
  });

  it('clamps a drag at the end of the diary day, and flashes the limit cue', () => {
    const entry = { id: 1, startOffsetMins: 1400, endOffsetMins: 1420, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const hitArea = revealHandle(el, 1, 'end');

    el.onEntryPointerDown({
      target: hitArea,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: hitArea, pointerId: 2, clientX: 0, clientY: 3000 }); // raw snap way past the day's end

    expect(el.activeDrag.currentEnd).toBe(1440);
    const rect = el.querySelector('#events rect[data-id="1"]');
    expect(rect.classList.contains('resize-limit-flash')).toBe(true);
  });

  it('clamps a drag to the current time when editing the current diary day, and flashes the limit cue', () => {
    appStore.dispatch({ type: SWITCH_DATE, payload: getCurrentDiaryDateKey() });
    const nowLimit = Math.floor(getCurrentOffsetMins() / 10) * 10;
    const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 10, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const hitArea = revealHandle(el, 1, 'end');

    el.onEntryPointerDown({
      target: hitArea,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: hitArea, pointerId: 2, clientX: 0, clientY: 3000 }); // raw snap way past "now"

    expect(el.activeDrag.currentEnd).toBe(nowLimit);
    const rect = el.querySelector('#events rect[data-id="1"]');
    expect(rect.classList.contains('resize-limit-flash')).toBe(true);
  });

  it('does not apply the "now" limit when editing a past diary day', () => {
    // beforeEach already switched to a fixed past date (2020-01-01)
    const entry = { id: 1, startOffsetMins: 1400, endOffsetMins: 1420, activity: 'Reading' };
    const el = createTimeline(2, [entry]);
    const hitArea = revealHandle(el, 1, 'end');

    el.onEntryPointerDown({
      target: hitArea,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: hitArea, pointerId: 2, clientX: 0, clientY: 2870 }); // raw snap -> 1430min, just inside the day

    expect(el.activeDrag.currentEnd).toBe(1430); // reached the target, unclamped by any "now"
  });
});

// Phase 4 of the drag-handle resize feature (see plans/drag-handle-resize.md):
// this phase is mostly confirmation - commitDrag() already keeps handles up
// (Phase 2) and the dismissal logic in onTimelineClick/onGlobalKeyDown is
// generic (Phase 1), not drag-aware - but neither was exercised through a
// real multi-drag sequence until now. These tests seed entries through the
// real ADD_ENTRY path (createEntry), unlike earlier phases' `el.entries =
// [...]` shortcut, because commitDrag's UPDATE_ENTRY dispatch reconciles
// `this.entries` against the store's real array - with more than one entry,
// a fabricated array that was never actually dispatched would lose every
// entry but the one just dragged the moment a commit re-renders from it.
describe('Timeline drag lifecycle', () => {
  beforeEach(() => {
    if (!customElements.get('el-timeline')) {
      customElements.define('el-timeline', Timeline);
    }
    if (!document.getElementById('svg-timeline')) {
      const template = document.createElement('template');
      template.id = 'svg-timeline';
      template.innerHTML = `
        <svg>
          <g id="timeline-shadow"></g>
          <rect id="future-overlay"></rect>
          <g id="events"></g>
        </svg>
      `;
      document.head.appendChild(template);
    }
    document.body.innerHTML = '';
    appStore.dispatch({ type: HIDE_PANEL });
    appStore.dispatch({ type: SWITCH_DATE, payload: '2020-01-01' });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    appStore.dispatch({ type: HIDE_PANEL });
  });

  function createTimeline(dimensionIndex) {
    const el = document.createElement('el-timeline');
    el.setAttribute('index', String(dimensionIndex));
    document.body.appendChild(el);
    return el;
  }

  function revealHandle(el, entryId, edge) {
    const rect = el.querySelector(`#events rect[data-id="${entryId}"]`);
    el.onEntryPointerDown({
      target: rect,
      pointerId: 1,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    vi.advanceTimersByTime(500);
    // a real long-press's own release also fires a click right after this,
    // swallowed by suppressNextClick - simulate it so that flag doesn't sit
    // armed and swallow an unrelated later onTimelineClick call in the test
    el.onTimelineClick({ target: rect });
    return el.querySelector(
      `#drag-handles .resize-handle[data-handle-edge="${edge}"] .resize-handle-hit-area`
    );
  }

  it('keeps the top handle draggable immediately after committing a bottom-handle drag, without a new long-press', () => {
    const el = createTimeline(2); // Location - single-choice
    el.createEntry({ startOffsetMins: 30, endOffsetMins: 90, activity: 'Reading' });
    el.renderEntries();
    const entry = el.entries.find((e) => e.startOffsetMins === 30);

    const endHit = revealHandle(el, entry.id, 'end');
    el.onEntryPointerDown({
      target: endHit,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: endHit, pointerId: 2, clientX: 0, clientY: 220 }); // -> 110min
    el.commitDrag();

    expect(el.activeHandleEntryId).toBe(entry.id);
    const startHit = el.querySelector(
      '#drag-handles .resize-handle[data-handle-edge="start"] .resize-handle-hit-area'
    );
    expect(startHit).not.toBeNull();

    // drag the top handle right away - no fresh long-press
    el.onEntryPointerDown({
      target: startHit,
      pointerId: 3,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: startHit, pointerId: 3, clientX: 0, clientY: 41 }); // -> 20min

    expect(el.activeDrag).toMatchObject({ entryId: entry.id, edge: 'start', currentStart: 20 });
  });

  it('commits two sequential drags on the same entry as two separate UPDATE_ENTRY dispatches', () => {
    const el = createTimeline(2);
    el.createEntry({ startOffsetMins: 30, endOffsetMins: 90, activity: 'Reading' });
    el.renderEntries();
    const entry = el.entries.find((e) => e.startOffsetMins === 30);
    const dispatchSpy = vi.spyOn(el.store, 'dispatch');

    const endHit = revealHandle(el, entry.id, 'end');
    el.onEntryPointerDown({
      target: endHit,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: endHit, pointerId: 2, clientX: 0, clientY: 220 }); // -> 110min
    el.commitDrag();

    const startHit = el.querySelector(
      '#drag-handles .resize-handle[data-handle-edge="start"] .resize-handle-hit-area'
    );
    el.onEntryPointerDown({
      target: startHit,
      pointerId: 3,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: startHit, pointerId: 3, clientX: 0, clientY: 41 }); // -> 20min
    el.commitDrag();

    const updateCalls = dispatchSpy.mock.calls.filter(([action]) => action.type === UPDATE_ENTRY);
    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0][0].payload).toMatchObject({
      id: entry.id,
      startOffsetMins: 30,
      endOffsetMins: 110,
    });
    expect(updateCalls[1][0].payload).toMatchObject({
      id: entry.id,
      startOffsetMins: 20,
      endOffsetMins: 110,
    });
  });

  it('dismisses handles when a later click lands elsewhere on the timeline, even after a completed drag', () => {
    const el = createTimeline(2);
    el.createEntry({ startOffsetMins: 30, endOffsetMins: 90, activity: 'Reading' });
    el.renderEntries();
    const entry = el.entries.find((e) => e.startOffsetMins === 30);

    const endHit = revealHandle(el, entry.id, 'end');
    el.onEntryPointerDown({
      target: endHit,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: endHit, pointerId: 2, clientX: 0, clientY: 220 });
    el.commitDrag();
    expect(el.activeHandleEntryId).toBe(entry.id);

    el.onTimelineClick({ target: { dataset: {} }, offsetY: 10 }); // a later click, on empty space

    expect(el.activeHandleEntryId).toBeUndefined();
    expect(el.querySelectorAll('#drag-handles .resize-handle')).toHaveLength(0);
  });

  it("dismisses this entry's handles when a later click opens a different entry, even after a completed drag", () => {
    const el = createTimeline(2);
    el.createEntry({ startOffsetMins: 30, endOffsetMins: 90, activity: 'Reading' });
    el.createEntry({ startOffsetMins: 200, endOffsetMins: 230, activity: 'Walking' });
    el.renderEntries();
    const entryA = el.entries.find((e) => e.startOffsetMins === 30);
    const entryB = el.entries.find((e) => e.startOffsetMins === 200);
    const openEntry = vi.fn();
    el.panelActions.openEntry = openEntry;

    const endHit = revealHandle(el, entryA.id, 'end');
    el.onEntryPointerDown({
      target: endHit,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: endHit, pointerId: 2, clientX: 0, clientY: 220 });
    el.commitDrag();
    expect(el.activeHandleEntryId).toBe(entryA.id);

    const rectB = el.querySelector(`#events rect[data-id="${entryB.id}"]`);
    el.onTimelineClick({ target: rectB });

    expect(el.activeHandleEntryId).toBeUndefined();
    expect(openEntry).toHaveBeenCalledWith(
      expect.objectContaining({ id: entryB.id, startOffsetMins: 200 })
    );
  });

  it('dismisses idle handles on Escape after a completed drag (no drag in progress)', () => {
    const el = createTimeline(2);
    el.createEntry({ startOffsetMins: 30, endOffsetMins: 90, activity: 'Reading' });
    el.renderEntries();
    const entry = el.entries.find((e) => e.startOffsetMins === 30);

    const endHit = revealHandle(el, entry.id, 'end');
    el.onEntryPointerDown({
      target: endHit,
      pointerId: 2,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    el.onEntryPointerMove({ target: endHit, pointerId: 2, clientX: 0, clientY: 220 });
    el.commitDrag();
    expect(el.activeHandleEntryId).toBe(entry.id);
    expect(el.activeDrag).toBeUndefined(); // idle, not mid-drag

    el.onGlobalKeyDown({ key: 'Escape' });

    expect(el.activeHandleEntryId).toBeUndefined();
    expect(el.querySelectorAll('#drag-handles .resize-handle')).toHaveLength(0);
  });
});

// regression coverage for Phase 9's multi-day data model: entries are now
// keyed by date as well as dimension, and every mounted Timeline needs to
// redraw when the store's currentDate changes underneath it (unlike an
// edit, which the acting instance already re-renders itself after).
describe('Timeline multi-day scoping', () => {
  beforeEach(() => {
    if (!customElements.get('el-timeline')) {
      customElements.define('el-timeline', Timeline);
    }
    if (!document.getElementById('svg-timeline')) {
      const template = document.createElement('template');
      template.id = 'svg-timeline';
      template.innerHTML = `
        <svg>
          <g id="timeline-shadow"></g>
          <rect id="future-overlay"></rect>
          <g id="events"></g>
        </svg>
      `;
      document.head.appendChild(template);
    }
    document.body.innerHTML = '';
  });

  function createTimeline(dimensionIndex) {
    const el = document.createElement('el-timeline');
    el.setAttribute('index', String(dimensionIndex));
    document.body.appendChild(el);
    return el;
  }

  it('keeps entries created on one date out of another date for the same dimension', () => {
    const dateA = '2026-08-21';
    const dateB = '2026-08-22';
    appStore.dispatch({ type: SWITCH_DATE, payload: dateA });
    const el = createTimeline(3); // Who

    el.createEntry({ startOffsetMins: 0, endOffsetMins: 30, activity: 'Family' });
    expect(el.entries).toHaveLength(1);

    appStore.dispatch({ type: SWITCH_DATE, payload: dateB });
    expect(el.entries).toHaveLength(0);

    appStore.dispatch({ type: SWITCH_DATE, payload: dateA });
    expect(el.entries).toHaveLength(1);
  });

  it('redraws the SVG entries layer when the date changes', () => {
    const dateC = '2026-09-01';
    const dateD = '2026-09-02';
    appStore.dispatch({ type: SWITCH_DATE, payload: dateC });
    appStore.dispatch({
      type: ADD_ENTRY,
      payload: {
        dimensionIndex: 3,
        date: dateC,
        startOffsetMins: 0,
        endOffsetMins: 30,
        activity: 'Family',
        id: 1,
      },
    });

    // mounted while dateC is current, so the pre-existing entry should
    // already be drawn
    const el = createTimeline(3);
    expect(el.querySelector('#events rect[data-id="1"]')).not.toBeNull();

    appStore.dispatch({ type: SWITCH_DATE, payload: dateD });

    expect(el.querySelector('#events rect[data-id="1"]')).toBeNull();
  });
});

// regression coverage: the future overlay greys out the remainder of
// "today" on the timeline - it should only appear when the diary date
// being viewed is the actual current diary day, not a past (or future) one
describe('Timeline future overlay', () => {
  beforeEach(() => {
    if (!customElements.get('el-timeline')) {
      customElements.define('el-timeline', Timeline);
    }
    if (!document.getElementById('svg-timeline')) {
      const template = document.createElement('template');
      template.id = 'svg-timeline';
      template.innerHTML = `
        <svg>
          <g id="timeline-shadow"></g>
          <rect id="future-overlay"></rect>
          <g id="events"></g>
        </svg>
      `;
      document.head.appendChild(template);
    }
    document.body.innerHTML = '';
  });

  function createTimeline(dimensionIndex) {
    const el = document.createElement('el-timeline');
    el.setAttribute('index', String(dimensionIndex));
    document.body.appendChild(el);
    return el;
  }

  it('shows the future overlay when viewing the actual current diary day', () => {
    appStore.dispatch({ type: SWITCH_DATE, payload: getCurrentDiaryDateKey() });
    const el = createTimeline(4);

    const height = Number(el.querySelector('#future-overlay').getAttribute('height'));
    expect(height).toBeGreaterThan(0);
  });

  it('hides the future overlay for a past diary day', () => {
    appStore.dispatch({ type: SWITCH_DATE, payload: '2000-01-01' });
    const el = createTimeline(4);

    const height = Number(el.querySelector('#future-overlay').getAttribute('height'));
    expect(height).toBe(0);
  });

  it('hides the future overlay immediately on switching away from today, without waiting for the 30s interval', () => {
    appStore.dispatch({ type: SWITCH_DATE, payload: getCurrentDiaryDateKey() });
    const el = createTimeline(4);
    expect(Number(el.querySelector('#future-overlay').getAttribute('height'))).toBeGreaterThan(0);

    appStore.dispatch({ type: SWITCH_DATE, payload: '2000-01-01' });

    expect(Number(el.querySelector('#future-overlay').getAttribute('height'))).toBe(0);
  });
});
