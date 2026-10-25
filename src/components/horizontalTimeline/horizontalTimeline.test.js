import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installSvgTemplates } from '../../testing/svgTemplates';
import { HorizontalTimeline } from './horizontalTimeline';
import { moveToNewParent, errorsDuring } from '../../testing/domMoves';
import { TinyBase } from '../base';
import { appStore } from '../../store/appStore';
import { ADD_ENTRY, SWITCH_DATE, SET_HORIZONTAL_ZOOM, HIDE_PANEL } from '../../store/actionTypes';
import { getCurrentDiaryDateKey } from '../../utils/time';

// HorizontalTimeline receives panelActions as injected props (from
// HorizontalTimelineStack in production), not self-created like Timeline's
// own panel - this harness stands in for the stack, registering a stub
// contract via the same setProps/key mechanism so tests can both exercise
// and assert on it.
class TestHarness extends TinyBase {}
if (!customElements.get('test-harness-horizontaltimeline')) {
  customElements.define('test-harness-horizontaltimeline', TestHarness);
}

// renderEntriesInto doesn't touch `this`, so it can be called directly off
// the prototype without constructing a full HorizontalTimeline instance
// (which requires the #svg-horizontal-timeline-row <template> from
// index.html to exist in the document) - same approach as
// timeline.test.js's `Timeline.renderEntriesInto` coverage.
const renderEntriesInto = HorizontalTimeline.prototype.renderEntriesInto;

function createSvgLayer() {
  return document.createElementNS('http://www.w3.org/2000/svg', 'g');
}

describe('HorizontalTimeline.renderEntriesInto', () => {
  it('renders one <g> per entry with an x/width-positioned rect and a labelled foreignObject', () => {
    const layer = createSvgLayer();
    const entries = [{ id: 1, startOffsetMins: 60, endOffsetMins: 90, activity: 'Sleep' }];

    renderEntriesInto({ layer, entries, dimensionIndex: 0 });

    const group = layer.querySelector('g');
    expect(group).not.toBeNull();

    const rect = group.querySelector('rect');
    expect(rect.getAttribute('x')).toBe('120'); // 60min * 2px/min
    expect(rect.getAttribute('y')).toBe('0');
    expect(rect.getAttribute('width')).toBe('60'); // (90-60)min * 2px/min
    expect(rect.getAttribute('height')).toBe('60'); // fixed row height
    expect(rect.getAttribute('data-id')).toBe('1');

    const foreignObject = group.querySelector('foreignObject');
    expect(foreignObject.getAttribute('x')).toBe('120');
    expect(foreignObject.getAttribute('width')).toBe('60');
    expect(foreignObject.getAttribute('height')).toBe('60');
    expect(foreignObject.querySelector('.event-label').textContent).toBe('Sleep');
  });

  it("joins a multiple-choice entry's activity array into one label", () => {
    const layer = createSvgLayer();
    const entries = [
      { id: 2, startOffsetMins: 0, endOffsetMins: 30, activity: ['Partner', 'Friends'] },
    ];

    renderEntriesInto({ layer, entries, dimensionIndex: 3 });

    expect(layer.querySelector('.event-label').textContent).toBe('Partner, Friends');
  });

  it('clears the layer before rendering, leaving no stale entries behind', () => {
    const layer = createSvgLayer();
    layer.innerHTML = '<g data-stale="true"></g>';

    renderEntriesInto({ layer, entries: [], dimensionIndex: 0 });

    expect(layer.querySelector('[data-stale]')).toBeNull();
    expect(layer.children.length).toBe(0);
  });
});

describe('HorizontalTimeline mounted', () => {
  beforeEach(() => {
    if (!customElements.get('el-horizontal-timeline')) {
      customElements.define('el-horizontal-timeline', HorizontalTimeline);
    }
    installSvgTemplates();
    document.body.innerHTML = '';
  });

  // stub panelActions (openEntry/openNewEntry/close/reportSaveConflict) are
  // always attached via the real setProps/key mechanism, mirroring how
  // HorizontalTimelineStack injects them in production. setProps binds each
  // function to the harness in place, so the *original* vi.fn() references
  // (not whatever ends up on el.panelActions afterwards) are what tests
  // assert against - a bound wrapper doesn't carry the mock's .mock property,
  // but it does still call through to the original on invocation.
  function createHorizontalTimeline(dimensionIndex, panelActionsOverrides = {}) {
    const harness = new TestHarness();
    const panelActions = {
      openEntry: vi.fn(),
      openNewEntry: vi.fn(),
      close: vi.fn(),
      reportSaveConflict: vi.fn(),
      ...panelActionsOverrides,
    };
    const key = harness.setProps({ ...panelActions }, true);
    const el = document.createElement('el-horizontal-timeline');
    el.setAttribute('index', String(dimensionIndex));
    el.setAttribute('key', key);
    document.body.appendChild(el);
    return { el, panelActions };
  }

  // regression coverage (#163): see the Timeline equivalent in timeline.test.js
  describe('moved in the DOM', () => {
    it('keeps its SVG, without errors, and still opens a new Entry from a click - once', () => {
      const { el, panelActions } = createHorizontalTimeline(2);
      const svg = el.timeLineElement;

      const errors = errorsDuring(() => moveToNewParent(el));
      el.querySelector('[data-part="gridline-zone"]').dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );

      expect(errors).toEqual([]);
      expect(el.querySelectorAll(':scope > svg')).toHaveLength(1);
      expect(el.timeLineElement).toBe(svg);
      expect(panelActions.openNewEntry).toHaveBeenCalledOnce();
    });
  });

  it('draws a pre-existing entry for its dimension/date on mount', () => {
    const date = '2026-08-21';
    appStore.dispatch({ type: SWITCH_DATE, payload: date });
    appStore.dispatch({
      type: ADD_ENTRY,
      payload: {
        dimensionIndex: 2,
        date,
        startOffsetMins: 0,
        endOffsetMins: 30,
        activity: 'Home',
        id: 1,
      },
    });

    const { el } = createHorizontalTimeline(2); // Location

    expect(el.querySelector('[data-part="events"] rect[data-id="1"]')).not.toBeNull();
  });

  it('redraws the SVG entries layer when the date changes', () => {
    const dateA = '2026-09-01';
    const dateB = '2026-09-02';
    appStore.dispatch({ type: SWITCH_DATE, payload: dateA });
    appStore.dispatch({
      type: ADD_ENTRY,
      payload: {
        dimensionIndex: 3,
        date: dateA,
        startOffsetMins: 0,
        endOffsetMins: 30,
        activity: ['Family'],
        id: 1,
      },
    });

    const { el } = createHorizontalTimeline(3); // Who
    expect(el.querySelector('[data-part="events"] rect[data-id="1"]')).not.toBeNull();

    appStore.dispatch({ type: SWITCH_DATE, payload: dateB });

    expect(el.querySelector('[data-part="events"] rect[data-id="1"]')).toBeNull();
  });

  // regression coverage (#143): see Timeline's equivalent test. Unlike
  // Timeline, updateState runs its re-render on *every* store update, so
  // this also pins that only an actual date change drops the selection
  it('drops the selected entry and closes the shared panel only when the date changes', () => {
    const dateA = '2026-09-11';
    const dateB = '2026-09-12';
    const entryOn = (date, activity) => ({
      type: ADD_ENTRY,
      payload: { dimensionIndex: 3, date, startOffsetMins: 0, endOffsetMins: 30, activity, id: 0 },
    });
    appStore.dispatch(entryOn(dateA, ['Family']));
    appStore.dispatch(entryOn(dateB, ['Friends']));
    appStore.dispatch({ type: SWITCH_DATE, payload: dateA });
    const { el, panelActions } = createHorizontalTimeline(3); // Who

    el.onTimelineClick({ target: { dataset: { id: '0' } } });
    appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: 2 }); // unrelated update
    expect(el.selectedID).toBe(0);
    expect(panelActions.close).not.toHaveBeenCalled();

    appStore.dispatch({ type: SWITCH_DATE, payload: dateB });

    expect(el.selectedID).toBeUndefined();
    expect(panelActions.close).toHaveBeenCalledOnce();
  });

  it('re-renders when an entry is added to the store after mount', () => {
    const date = '2026-09-10';
    appStore.dispatch({ type: SWITCH_DATE, payload: date });
    const { el } = createHorizontalTimeline(4); // Device
    expect(el.querySelector('[data-part="events"] rect')).toBeNull();

    appStore.dispatch({
      type: ADD_ENTRY,
      payload: {
        dimensionIndex: 4,
        date,
        startOffsetMins: 10,
        endOffsetMins: 20,
        activity: 'Phone',
        id: 7,
      },
    });

    expect(el.querySelector('[data-part="events"] rect[data-id="7"]')).not.toBeNull();
  });

  // Phase 10.5: geometry and the svg's own width/viewBox are both
  // recomputed from the current horizontalZoomLevel, keeping 1 viewBox
  // unit = 1 CSS px at every zoom level (see the Phase 10.5 plan)
  describe('zoom', () => {
    beforeEach(() => {
      appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: 1 });
    });

    it('sizes the svg to the native width at zoom 1', () => {
      const { el } = createHorizontalTimeline(0);
      expect(el.querySelector('svg').getAttribute('width')).toBe('2880'); // 1440min * 2px/min
    });

    it('rescales the svg and entry geometry on a zoom change', () => {
      const date = '2026-10-01';
      appStore.dispatch({ type: SWITCH_DATE, payload: date });
      appStore.dispatch({
        type: ADD_ENTRY,
        payload: {
          dimensionIndex: 5,
          date,
          startOffsetMins: 60,
          endOffsetMins: 90,
          activity: '5',
          id: 9,
        },
      });
      const { el } = createHorizontalTimeline(5); // Enjoyment
      const rectBefore = el.querySelector('rect[data-id="9"]');
      expect(rectBefore.getAttribute('x')).toBe('120'); // 60min * 2px/min
      expect(rectBefore.getAttribute('width')).toBe('60'); // 30min * 2px/min

      appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: 2 });

      expect(el.querySelector('svg').getAttribute('width')).toBe('5760'); // 1440min * 4px/min
      const rectAfter = el.querySelector('rect[data-id="9"]');
      expect(rectAfter.getAttribute('x')).toBe('240'); // 60min * 4px/min
      expect(rectAfter.getAttribute('width')).toBe('120'); // 30min * 4px/min
    });

    it('keeps the entry label at a constant 14px font-size regardless of zoom', () => {
      const date = '2026-10-02';
      appStore.dispatch({ type: SWITCH_DATE, payload: date });
      appStore.dispatch({
        type: ADD_ENTRY,
        payload: {
          dimensionIndex: 1,
          date,
          startOffsetMins: 0,
          endOffsetMins: 30,
          activity: 'Reading',
          id: 10,
        },
      });
      const { el } = createHorizontalTimeline(1);

      appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: 4 });

      const label = el.querySelector('.event-label[data-id="10"]');
      expect(label.style.fontSize).toBe('14px');
    });
  });

  // Phase 10.6: click-to-add/select and drag-to-resize, ported from
  // Timeline via EntryResizeController's X_AXIS config - the controller's
  // own clamping/long-press/drag logic is already covered exhaustively by
  // timeline.test.js's full suite (passing unmodified after generalizing
  // the controller is itself the regression check for that logic); these
  // tests instead confirm the x-axis-specific wiring (zoom-aware pxPerMinute,
  // panelActions arriving as injected props rather than self-created).
  describe('interactions', () => {
    beforeEach(() => {
      appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: 1 });
    });

    it('calls panelActions.openNewEntry with the clicked time slot on a gridline-zone click', () => {
      const { el, panelActions } = createHorizontalTimeline(0);

      // clientToSvgCoord falls back to raw clientX in this test environment
      // (no SVG geometry APIs), same as Timeline's own equivalent test
      el.onTimelineClick({
        target: { dataset: { part: 'gridline-zone' } },
        clientX: 40,
        clientY: 0,
      });

      expect(panelActions.openNewEntry).toHaveBeenCalledWith(20); // calculateTheTimeSlotClicked(40) -> 20
    });

    it('calls panelActions.openEntry with the clicked entry', () => {
      const { el, panelActions } = createHorizontalTimeline(0);
      const entry = { id: 5, startOffsetMins: 60, endOffsetMins: 90, activity: 'Sleep' };
      el.entries = [entry];

      el.onTimelineClick({ target: { dataset: { id: '5' } } });

      expect(panelActions.openEntry).toHaveBeenCalledWith(entry);
    });

    describe('invalid input (#144)', () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      // see Timeline's equivalent regression tests for the full reasoning
      it.each([
        ['no longer present in entries', '5'],
        ['not numeric', 'abc'],
      ])('does not open the panel when the clicked data-id is %s', (_, dataId) => {
        const { el, panelActions } = createHorizontalTimeline(0);
        el.entries = [];
        vi.spyOn(console, 'error').mockImplementation(() => {});

        el.onTimelineClick({ target: { dataset: { id: dataId } } });

        expect(panelActions.openEntry).not.toHaveBeenCalled();
        expect(el.selectedID).toBeUndefined();
      });

      it.each(['createEntry', 'updateEntry'])(
        '%s dispatches nothing when the dimension index is not a valid integer',
        (method) => {
          const { el } = createHorizontalTimeline(0);
          el.dimensionIndex = NaN;
          const dispatch = vi.spyOn(appStore, 'dispatch');
          vi.spyOn(console, 'error').mockImplementation(() => {});

          el[method]({ startOffsetMins: 0, endOffsetMins: 30, activity: 'Sleep' });

          expect(dispatch).not.toHaveBeenCalled();
        }
      );
    });

    it('does not open a new entry for a click outside the gridline zone', () => {
      const { el, panelActions } = createHorizontalTimeline(0);

      el.onTimelineClick({ target: { id: 'something-else', dataset: {} } });

      expect(panelActions.openNewEntry).not.toHaveBeenCalled();
    });

    it('zoom-aware calculateTheTimeSlotClicked scales with the current zoom level', () => {
      const { el } = createHorizontalTimeline(0);
      expect(el.calculateTheTimeSlotClicked(40)).toBe(20); // 40px / (2px/min * 10) = 2 -> 20min at native zoom

      appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: 2 });

      expect(el.calculateTheTimeSlotClicked(40)).toBe(10); // same 40px now covers less time at 2x zoom
    });

    it('long-press reveals resize handles, and a drag commits a correct UPDATE_ENTRY', () => {
      vi.useFakeTimers();
      appStore.dispatch({ type: HIDE_PANEL });
      const date = getCurrentDiaryDateKey();
      appStore.dispatch({ type: SWITCH_DATE, payload: date });
      appStore.dispatch({
        type: ADD_ENTRY,
        payload: {
          dimensionIndex: 2,
          date,
          startOffsetMins: 0,
          endOffsetMins: 30,
          activity: 'Home',
          id: 1,
        },
      });
      const { el } = createHorizontalTimeline(2);
      const rect = el.querySelector('[data-part="events"] rect[data-id="1"]');

      el.onEntryPointerDown({
        target: rect,
        pointerId: 1,
        pointerType: 'touch',
        clientX: 0,
        clientY: 0,
      });
      vi.advanceTimersByTime(500);
      const endHandleHitArea = el.querySelector(
        '[data-part="drag-handles"] .resize-handle[data-handle-edge="end"] .resize-handle-hit-area'
      );
      expect(endHandleHitArea).not.toBeNull();

      el.onEntryPointerDown({
        target: endHandleHitArea,
        pointerId: 2,
        pointerType: 'touch',
        clientX: 0,
        clientY: 0,
      });
      // clientToSvgCoord falls back to raw clientX in this test environment;
      // 100px -> calculateTheTimeSlotClicked(100) = 50min at native zoom
      el.onEntryPointerMove({ target: endHandleHitArea, pointerId: 2, clientX: 100, clientY: 0 });
      el.resizeController.handlePointerUp({ pointerId: 2 });

      const updatedEntry = appStore.getState().diaries[date].timelines[2].find((e) => e.id === 1);
      expect(updatedEntry.endOffsetMins).toBe(50);
      vi.useRealTimers();
    });
  });
});
