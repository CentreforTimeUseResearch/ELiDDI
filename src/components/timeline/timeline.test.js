import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Timeline } from './timeline';
// Timeline only references '<el-details-panel>' as a string in its render
// template - it never imports the class, so DetailsPanel is only ever
// registered as a customElements side effect of *something* importing it.
// Pull that in explicitly so the panelActions contract can actually wire up.
import '../detailsPanel/detailsPanel';
import { appStore } from '../../store/appStore';
import { ADD_ENTRY, SWITCH_DATE } from '../../store/actionTypes';
import { getCurrentDiaryDateKey } from '../../utils/time';

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

  it('calls panelActions.openNewEntry (not a direct method call) when clicking empty space', () => {
    const el = createTimeline(4); // Device
    const openNewEntry = vi.fn();
    el.panelActions.openNewEntry = openNewEntry;

    el.onTimelineClick({ target: { dataset: {} }, offsetY: 40 });

    expect(openNewEntry).toHaveBeenCalledWith(20); // calculateTheTimeSlotClicked(40) -> 20
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
