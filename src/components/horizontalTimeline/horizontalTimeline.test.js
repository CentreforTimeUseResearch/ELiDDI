import { describe, it, expect, beforeEach } from 'vitest';
import { HorizontalTimeline } from './horizontalTimeline';
import { appStore } from '../../store/appStore';
import { ADD_ENTRY, SWITCH_DATE, SET_HORIZONTAL_ZOOM } from '../../store/actionTypes';

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
    expect(rect.getAttribute('height')).toBe('110'); // fixed row height
    expect(rect.getAttribute('data-id')).toBe('1');

    const foreignObject = group.querySelector('foreignObject');
    expect(foreignObject.getAttribute('x')).toBe('120');
    expect(foreignObject.getAttribute('width')).toBe('60');
    expect(foreignObject.getAttribute('height')).toBe('110');
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
    if (!document.getElementById('svg-horizontal-timeline-row')) {
      const template = document.createElement('template');
      template.id = 'svg-horizontal-timeline-row';
      template.innerHTML = `
        <svg>
          <g id="events"></g>
        </svg>
      `;
      document.head.appendChild(template);
    }
    document.body.innerHTML = '';
  });

  function createHorizontalTimeline(dimensionIndex) {
    const el = document.createElement('el-horizontal-timeline');
    el.setAttribute('index', String(dimensionIndex));
    document.body.appendChild(el);
    return el;
  }

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

    const el = createHorizontalTimeline(2); // Location

    expect(el.querySelector('#events rect[data-id="1"]')).not.toBeNull();
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

    const el = createHorizontalTimeline(3); // Who
    expect(el.querySelector('#events rect[data-id="1"]')).not.toBeNull();

    appStore.dispatch({ type: SWITCH_DATE, payload: dateB });

    expect(el.querySelector('#events rect[data-id="1"]')).toBeNull();
  });

  it('re-renders when an entry is added to the store after mount', () => {
    const date = '2026-09-10';
    appStore.dispatch({ type: SWITCH_DATE, payload: date });
    const el = createHorizontalTimeline(4); // Device
    expect(el.querySelector('#events rect')).toBeNull();

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

    expect(el.querySelector('#events rect[data-id="7"]')).not.toBeNull();
  });

  // Phase 10.5: geometry and the svg's own width/viewBox are both
  // recomputed from the current horizontalZoomLevel, keeping 1 viewBox
  // unit = 1 CSS px at every zoom level (see the Phase 10.5 plan)
  describe('zoom', () => {
    beforeEach(() => {
      appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: 1 });
    });

    it('sizes the svg to the native width at zoom 1', () => {
      const el = createHorizontalTimeline(0);
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
      const el = createHorizontalTimeline(5); // Enjoyment
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
      const el = createHorizontalTimeline(1);

      appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: 4 });

      const label = el.querySelector('.event-label[data-id="10"]');
      expect(label.style.fontSize).toBe('14px');
    });
  });
});
