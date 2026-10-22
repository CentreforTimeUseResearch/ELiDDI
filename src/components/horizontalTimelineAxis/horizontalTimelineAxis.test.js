import { describe, it, expect, beforeEach } from 'vitest';
import { HorizontalTimelineAxis } from './horizontalTimelineAxis';
import { appStore } from '../../store/appStore';
import { SWITCH_DATE } from '../../store/actionTypes';
import { getCurrentDiaryDateKey } from '../../utils/time';

describe('HorizontalTimelineAxis future overlay', () => {
  beforeEach(() => {
    if (!customElements.get('el-horizontal-timeline-axis')) {
      customElements.define('el-horizontal-timeline-axis', HorizontalTimelineAxis);
    }
    if (!document.getElementById('svg-horizontal-timeline-axis')) {
      const template = document.createElement('template');
      template.id = 'svg-horizontal-timeline-axis';
      template.innerHTML = `
        <svg>
          <rect id="future-overlay"></rect>
          <g id="grid-lines"></g>
          <g id="hour-labels"></g>
        </svg>
      `;
      document.head.appendChild(template);
    }
    document.body.innerHTML = '';
  });

  function createAxis() {
    const el = document.createElement('el-horizontal-timeline-axis');
    document.body.appendChild(el);
    return el;
  }

  it('shows the future overlay when viewing the actual current diary day', () => {
    appStore.dispatch({ type: SWITCH_DATE, payload: getCurrentDiaryDateKey() });
    const el = createAxis();

    const width = Number(el.querySelector('#future-overlay').getAttribute('width'));
    expect(width).toBeGreaterThan(0);
  });

  it('hides the future overlay for a past diary day', () => {
    appStore.dispatch({ type: SWITCH_DATE, payload: '2000-01-01' });
    const el = createAxis();

    const width = Number(el.querySelector('#future-overlay').getAttribute('width'));
    expect(width).toBe(0);
  });

  it('hides the future overlay immediately on switching away from today, without waiting for the 30s interval', () => {
    appStore.dispatch({ type: SWITCH_DATE, payload: getCurrentDiaryDateKey() });
    const el = createAxis();
    expect(Number(el.querySelector('#future-overlay').getAttribute('width'))).toBeGreaterThan(0);

    appStore.dispatch({ type: SWITCH_DATE, payload: '2000-01-01' });

    expect(Number(el.querySelector('#future-overlay').getAttribute('width'))).toBe(0);
  });
});
