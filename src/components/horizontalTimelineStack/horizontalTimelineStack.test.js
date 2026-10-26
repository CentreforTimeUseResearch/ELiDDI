import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installSvgTemplates } from '../../testing/svgTemplates';
import { HorizontalTimelineStack } from './horizontalTimelineStack';
import { moveToNewParent, errorsDuring } from '../../testing/domMoves';
// HorizontalTimelineStack only references '<el-details-panel>' as a string
// in its render() (same reasoning as Timeline, see timeline.test.js) - pull
// it in explicitly so the panelActions contract can actually wire up.
import { DetailsPanel } from '../detailsPanel/detailsPanel';
import { appStore } from '../../store/appStore';
import { HIDE_PANEL, SHOW_PANEL, SWITCH_DATE, SWITCH_DIMENSION } from '../../store/actionTypes';
import { addSpecialDimension, SPECIAL_DIMENSION } from '../../testing/specialCharacters';

const DIMENSION_COUNT = GLOBALS.DATA.timeline.length;

describe('HorizontalTimelineStack', () => {
  beforeEach(() => {
    if (!customElements.get('el-horizontal-timeline-stack')) {
      customElements.define('el-horizontal-timeline-stack', HorizontalTimelineStack);
    }
    if (!customElements.get('el-details-panel')) {
      customElements.define('el-details-panel', DetailsPanel);
    }
    installSvgTemplates();
    document.body.innerHTML = '';
    appStore.dispatch({ type: HIDE_PANEL });
  });

  function createStack() {
    const el = document.createElement('el-horizontal-timeline-stack');
    document.body.appendChild(el);
    return el;
  }

  // regression coverage (#163): render() appended a new axis, rows and
  // panel on every connection, so a moved stack doubled them
  it('keeps one axis, its rows and one panel when moved, and its rows still open Entries', () => {
    const el = createStack();
    const children = [...el.children];

    const errors = errorsDuring(() => moveToNewParent(el));
    appStore.dispatch({ type: HIDE_PANEL });
    el.querySelectorAll('el-horizontal-timeline')[2]
      .querySelector('[data-part="gridline-zone"]')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(errors).toEqual([]);
    expect([...el.children]).toEqual(children);
    expect(appStore.getState().uipanel).toBe('details');
    expect(el.panelElement.getAttribute('dimensionindex')).toBe('2');
  });

  it('mounts one axis, a label and a row per Dimension, and one shared details panel, in order', () => {
    const el = createStack();

    expect(el.children.length).toBe(DIMENSION_COUNT * 2 + 2); // axis + 6 label/row pairs + panel
    expect(el.children[0].tagName.toLowerCase()).toBe('el-horizontal-timeline-axis');
    for (let i = 0; i < DIMENSION_COUNT; i++) {
      const label = el.children[i * 2 + 1];
      const row = el.children[i * 2 + 2];
      expect(label.tagName).toBe('BUTTON');
      expect(label.dataset.dimensionIndex).toBe(String(i));
      expect(row.tagName.toLowerCase()).toBe('el-horizontal-timeline');
      expect(row.getAttribute('index')).toBe(String(i));
    }
    expect(el.children[DIMENSION_COUNT * 2 + 1].tagName.toLowerCase()).toBe('el-details-panel');
  });

  describe('Dimension labels', () => {
    it('names each Dimension, in the same grid row as its timeline row', () => {
      const el = createStack();

      el.querySelectorAll('.dimension-label').forEach((label, i) => {
        expect(label.textContent).toBe(GLOBALS.DATA.timeline[i].name);
        expect(label.style.gridRow).toBe(el.rows[i].style.gridRow);
        // row 1 is the axis
        expect(label.style.gridRow).toBe(String(i + 2));
      });
    });

    // regression coverage (#146), moved from Navbar with the list
    it('shows a Dimension name containing HTML special characters as text', () => {
      const special = addSpecialDimension();
      try {
        const el = createStack();

        const label = el.querySelector(`[data-dimension-index="${special.index}"]`);
        expect(label.textContent).toBe(SPECIAL_DIMENSION.name);
        expect(label.children.length).toBe(0);
      } finally {
        special.remove();
      }
    });

    it('switches to that Dimension and hides the panel when a label is clicked', () => {
      appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });
      const el = createStack();

      el.querySelectorAll('.dimension-label')[2].click();

      expect(appStore.getState().currentDimensionIndex).toBe(2);
      expect(appStore.getState().uipanel).not.toBe('details');
    });

    it('marks only the current Dimension, and follows it as it changes', () => {
      appStore.dispatch({ type: SWITCH_DIMENSION, payload: 1 });
      const el = createStack();
      const current = () =>
        [...el.querySelectorAll('.dimension-label')]
          .filter((label) => label.getAttribute('aria-current') === 'true')
          .map((label) => label.dataset.dimensionIndex);

      expect(current()).toEqual(['1']);

      appStore.dispatch({ type: SWITCH_DIMENSION, payload: 4 });

      expect(current()).toEqual(['4']);
    });
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

    // #151: there is always a current Dimension, so the panel always acts
    // on that Dimension's row - before any row has been clicked, too
    it("routes to the current Dimension's row before any row has been clicked", () => {
      appStore.dispatch({ type: SWITCH_DIMENSION, payload: 4 });
      const el = createStack();
      const findSpy = vi.spyOn(el.rows[4], 'findNextEntryAfter');

      el.findNextEntryAfter(30);

      expect(findSpy).toHaveBeenCalledWith(30);
      expect(el.panelElement.getAttribute('dimensionindex')).toBe('4');
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
