import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HorizontalTimelineStack } from './horizontalTimelineStack';
// HorizontalTimelineStack only references '<el-details-panel>' as a string
// in its render() (same reasoning as Timeline, see timeline.test.js) - pull
// it in explicitly so the panelActions contract can actually wire up.
import { DetailsPanel } from '../detailsPanel/detailsPanel';
import { appStore } from '../../store/appStore';
import { HIDE_PANEL, SWITCH_DATE } from '../../store/actionTypes';

const DIMENSION_COUNT = GLOBALS.DATA.timeline.length;

describe('HorizontalTimelineStack', () => {
  beforeEach(() => {
    if (!customElements.get('el-horizontal-timeline-stack')) {
      customElements.define('el-horizontal-timeline-stack', HorizontalTimelineStack);
    }
    if (!customElements.get('el-details-panel')) {
      customElements.define('el-details-panel', DetailsPanel);
    }
    if (!document.getElementById('svg-horizontal-timeline-axis')) {
      const template = document.createElement('template');
      template.id = 'svg-horizontal-timeline-axis';
      template.innerHTML = `
        <svg>
          <rect id="future-overlay"></rect>
          <g id="grid-lines"></g>
          <rect id="gradient-bar"></rect>
          <g id="hour-labels"></g>
        </svg>
      `;
      document.head.appendChild(template);
    }
    if (!document.getElementById('svg-horizontal-timeline-row')) {
      const template = document.createElement('template');
      template.id = 'svg-horizontal-timeline-row';
      template.innerHTML = `
        <svg>
          <rect id="gridline_zone"></rect>
          <g id="events"></g>
          <g id="drag-handles"></g>
        </svg>
      `;
      document.head.appendChild(template);
    }
    document.body.innerHTML = '';
    appStore.dispatch({ type: HIDE_PANEL });
  });

  function createStack() {
    const el = document.createElement('el-horizontal-timeline-stack');
    document.body.appendChild(el);
    return el;
  }

  it('mounts one axis, one row per Dimension, and one shared details panel, in order', () => {
    const el = createStack();

    expect(el.children.length).toBe(DIMENSION_COUNT + 2); // axis + 6 rows + panel
    expect(el.children[0].tagName.toLowerCase()).toBe('el-horizontal-timeline-axis');
    for (let i = 0; i < DIMENSION_COUNT; i++) {
      const row = el.children[i + 1];
      expect(row.tagName.toLowerCase()).toBe('el-horizontal-timeline');
      expect(row.getAttribute('index')).toBe(String(i));
    }
    expect(el.children[DIMENSION_COUNT + 1].tagName.toLowerCase()).toBe('el-details-panel');
  });

  describe('panel orchestration', () => {
    it('dispatches SWITCH_DIMENSION and SHOW_PANEL when a row opens an entry', () => {
      const el = createStack();

      el.openEntryForRow(2, { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Home' });

      expect(appStore.getState().currentDimensionIndex).toBe(2);
      expect(appStore.getState().uipanel).toBe('details');
    });

    it('sets the panel dimensionindex/heading/instruction to the opened row and rebuilds it', () => {
      const el = createStack();
      const dimensionData = GLOBALS.DATA.timeline[3];
      const resetSpy = vi.spyOn(el.panelElement, 'reset');

      el.openNewEntryForRow(3, 60);

      expect(el.panelElement.getAttribute('dimensionindex')).toBe('3');
      expect(el.panelElement.getAttribute('heading')).toBe(dimensionData.description ?? '');
      // reset() is called twice here: once by activateRow() (dimension
      // changed) and once more by DetailsPanel.openNewEntry()'s own
      // internal reset() - both legitimate, harmless since reset() is
      // idempotent. openEntry() (editing an existing entry, tested below)
      // has no such internal call, so only activateRow()'s counts there.
      expect(resetSpy).toHaveBeenCalledTimes(2);
    });

    it('does not rebuild the panel again when the same row opens a second entry', () => {
      const el = createStack();
      el.openEntryForRow(2, { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Home' });
      const resetSpy = vi.spyOn(el.panelElement, 'reset');

      el.openEntryForRow(2, { id: 2, startOffsetMins: 60, endOffsetMins: 90, activity: 'Work' });

      expect(resetSpy).not.toHaveBeenCalled();
    });

    it('rebuilds the panel again when a different row opens an entry next', () => {
      const el = createStack();
      el.openEntryForRow(2, { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Home' });
      const resetSpy = vi.spyOn(el.panelElement, 'reset');

      el.openEntryForRow(4, { id: 2, startOffsetMins: 60, endOffsetMins: 90, activity: 'Phone' });

      expect(resetSpy).toHaveBeenCalledOnce();
      expect(el.panelElement.getAttribute('dimensionindex')).toBe('4');
    });
  });

  describe('panelActions delegation', () => {
    it('delegates saveEntry/deleteEntry/findNextEntryAfter to the currently active row', () => {
      const el = createStack();
      const row = el.rows[2];
      const saveSpy = vi.spyOn(row, 'saveEntry').mockImplementation(() => {});
      const deleteSpy = vi.spyOn(row, 'deleteEntry').mockImplementation(() => {});
      const findSpy = vi.spyOn(row, 'findNextEntryAfter').mockReturnValue(undefined);
      el.openEntryForRow(2, { id: 1, startOffsetMins: 0, endOffsetMins: 30, activity: 'Home' });

      el.saveEntry({ activity: 'Home' });
      el.deleteEntry(1);
      el.findNextEntryAfter(30);

      expect(saveSpy).toHaveBeenCalledWith({ activity: 'Home' });
      expect(deleteSpy).toHaveBeenCalledWith(1);
      expect(findSpy).toHaveBeenCalledWith(30);
    });

    it('does not throw when nothing has been activated yet', () => {
      const el = createStack();

      expect(() => el.saveEntry({})).not.toThrow();
      expect(() => el.deleteEntry(1)).not.toThrow();
      expect(el.findNextEntryAfter(0)).toBeUndefined();
    });
  });

  // end-to-end: a real click on one row's gridline, then another row's,
  // correctly routes through the whole chain (row -> injected panelActions
  // -> stack orchestration -> real shared panel)
  describe('end-to-end click routing', () => {
    it('opens the clicked row entry in the shared panel via a real click', () => {
      appStore.dispatch({ type: SWITCH_DATE, payload: '2026-10-10' });
      const el = createStack();
      const row = el.rows[1];
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.dataset.id = '0';
      row.entries = [{ id: 0, startOffsetMins: 30, endOffsetMins: 60, activity: 'Reading' }];

      row.onTimelineClick({ target: rect });

      expect(appStore.getState().currentDimensionIndex).toBe(1);
      expect(appStore.getState().uipanel).toBe('details');
    });
  });
});
