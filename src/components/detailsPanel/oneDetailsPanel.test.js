import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../timelineStack/timelineStack';
import '../horizontalTimelineStack/horizontalTimelineStack';
import { appStore } from '../../store/appStore';
import { HIDE_PANEL, SWITCH_DATE, SWITCH_DIMENSION, ADD_TIMELINE } from '../../store/actionTypes';
import { getActivityDisplayName } from '../../utils/activities';

// #151 / ADR 0005: one details panel in every layout, routed to the
// current Dimension by DetailsPanelCoordinator. Each test runs against the
// real mobile and desktop stacks.

function addTemplate(id, markup) {
  if (!document.getElementById(id)) {
    const template = document.createElement('template');
    template.id = id;
    template.innerHTML = markup;
    document.head.appendChild(template);
  }
}

const DATE = '2026-07-01';
const DIMENSIONS = GLOBALS.DATA.timeline;
const firstActivityOf = (dimensionIndex) =>
  getActivityDisplayName(DIMENSIONS[dimensionIndex].categories[0].activities[0]);

describe.each([
  ['mobile', 'el-timeline-stack', 'el-timeline'],
  ['desktop', 'el-horizontal-timeline-stack', 'el-horizontal-timeline'],
])('one details panel (%s)', (_, stackTag, timelineTag) => {
  let stack;

  beforeEach(() => {
    addTemplate(
      'svg-timeline',
      '<svg><rect id="gridline_zone"></rect><g id="timeline-shadow"></g><rect id="future-overlay"></rect><g id="events"></g></svg>'
    );
    addTemplate(
      'svg-horizontal-timeline-axis',
      '<svg><rect id="future-overlay"></rect><g id="grid-lines"></g><rect id="gradient-bar"></rect><g id="hour-labels"></g></svg>'
    );
    addTemplate(
      'svg-horizontal-timeline-row',
      '<svg><rect id="gridline_zone"></rect><g id="events"></g><g id="drag-handles"></g></svg>'
    );
    document.body.innerHTML = '';
    appStore.dispatch({ type: SWITCH_DATE, payload: DATE });
    DIMENSIONS.forEach((__, dimensionIndex) =>
      appStore.dispatch({ type: ADD_TIMELINE, payload: { dimensionIndex, date: DATE } })
    );
    appStore.dispatch({ type: SWITCH_DIMENSION, payload: 0 });
    appStore.dispatch({ type: HIDE_PANEL });
    stack = document.createElement(stackTag);
    document.body.appendChild(stack);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    stack.remove();
  });

  const panel = () => document.querySelector('el-details-panel');
  const timelines = () => [...document.querySelectorAll(timelineTag)];
  const switchTo = (dimensionIndex) =>
    appStore.dispatch({ type: SWITCH_DIMENSION, payload: dimensionIndex });
  const startNewEntry = (dimensionIndex, startOffsetMins) =>
    timelines()[dimensionIndex].panelActions.openNewEntry(startOffsetMins);

  it('serves every Dimension with one panel, retargeted to the current one', () => {
    expect(document.querySelectorAll('el-details-panel')).toHaveLength(1);

    DIMENSIONS.forEach((dimension, dimensionIndex) => {
      switchTo(dimensionIndex);

      expect(panel().getAttribute('dimensionindex')).toBe(String(dimensionIndex));
      expect(panel().getAttribute('heading')).toBe(dimension.description ?? '');
      expect(panel().querySelector('[data-activity]').dataset.activity).toBe(
        firstActivityOf(dimensionIndex)
      );
    });
    expect(document.querySelectorAll('el-details-panel')).toHaveLength(1);
  });

  it('keeps an unsaved draft per Dimension, and follows a Dimension change while open', () => {
    startNewEntry(0, 60);
    panel().setActivity(firstActivityOf(0));
    panel().setEndTime(90);

    switchTo(1);
    expect(appStore.getState().uipanel).toBe('details'); // still open
    expect(panel().state).toEqual({});

    switchTo(0);
    expect(panel().state).toEqual({
      startOffsetMins: 60,
      endOffsetMins: 90,
      activity: firstActivityOf(0),
    });
  });

  it('replaces a parked draft when that Dimension is opened afresh', () => {
    startNewEntry(0, 60);
    panel().setActivity(firstActivityOf(0));
    switchTo(1);

    startNewEntry(0, 120);

    expect(panel().getAttribute('dimensionindex')).toBe('0');
    expect(panel().state).toEqual({ startOffsetMins: 120, endOffsetMins: 130 });
  });

  it('ends every draft when the Diary date changes', () => {
    startNewEntry(0, 60);
    panel().setActivity(firstActivityOf(0));
    switchTo(1);
    startNewEntry(1, 200);

    appStore.dispatch({ type: SWITCH_DATE, payload: '2026-07-02' });
    expect(panel().state).toEqual({});
    switchTo(0);

    expect(panel().state).toEqual({});
  });

  it("saves to the current Dimension's Timeline", () => {
    startNewEntry(2, 60);
    panel().setActivity(firstActivityOf(2));
    panel().setEndTime(90);

    panel().querySelector('.btn-save-btn').click();

    expect(appStore.getState().diaries[DATE].timelines[2]).toEqual([
      expect.objectContaining({
        startOffsetMins: 60,
        endOffsetMins: 90,
        activity: firstActivityOf(2),
      }),
    ]);
  });

  // the dangling references #151 listed, which affected both layouts
  describe('form references', () => {
    const ids = (attribute) =>
      [...panel().querySelectorAll(`[${attribute}]`)].flatMap((element) =>
        element.getAttribute(attribute).split(/\s+/).filter(Boolean)
      );

    it('gives every id in the panel a single owner in the whole document', () => {
      [...panel().querySelectorAll('[id]')].forEach((element) => {
        expect(document.querySelectorAll(`[id="${element.id}"]`), element.id).toHaveLength(1);
      });
    });

    it('resolves every label and aria reference to an element inside the panel', () => {
      const referenced = [
        ...[...panel().querySelectorAll('label[for]')].map((label) => label.htmlFor),
        ...ids('aria-describedby'),
        ...ids('aria-labelledby'),
        ...ids('aria-controls'),
      ];
      expect(referenced.length).toBeGreaterThan(0);
      referenced.forEach((id) => {
        expect(panel().contains(document.getElementById(id)), id).toBe(true);
      });
    });

    it('labels the start and end time inputs', () => {
      ['startTime', 'endTime'].forEach((inputId) => {
        const input = panel().querySelector(`[data-id="${inputId}"]`);
        expect(input.labels, inputId).toHaveLength(1);
      });
    });
  });
});
