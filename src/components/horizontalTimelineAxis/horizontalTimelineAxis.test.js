import { describe, it, expect, beforeEach } from 'vitest';
import { HorizontalTimelineAxis } from './horizontalTimelineAxis';
import { appStore } from '../../store/appStore';
import { SWITCH_DATE, SET_HORIZONTAL_ZOOM } from '../../store/actionTypes';
import { getCurrentDiaryDateKey } from '../../utils/time';
import { MAX_ZOOM } from './zoomConstants';

function setClientWidth(el, width) {
  Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
}

describe('HorizontalTimelineAxis', () => {
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
          <rect id="gradient-bar"></rect>
          <g id="hour-labels"></g>
        </svg>
      `;
      document.head.appendChild(template);
    }
    document.body.innerHTML = '';
    appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: 1 });
  });

  // mounted inside a wrapper whose clientWidth is controllable, since
  // computeMinZoom() reads this.parentElement.clientWidth (jsdom reports 0
  // for everything by default, which would make every zoom-out look like
  // it's already at the fit-to-viewport minimum)
  function createAxis({ containerWidth = 2880 } = {}) {
    const wrapper = document.createElement('div');
    setClientWidth(wrapper, containerWidth);
    document.body.appendChild(wrapper);
    const el = document.createElement('el-horizontal-timeline-axis');
    wrapper.appendChild(el);
    return el;
  }

  describe('grid generation', () => {
    it('renders a tick every 10 minutes, 145 total, at native zoom', () => {
      const el = createAxis();
      expect(el.querySelectorAll('#grid-lines line').length).toBe(145); // 0..1440 step 10
    });

    it('draws hour marks solid and gray, half-hour marks dashed, other ticks plain', () => {
      const el = createAxis();
      const lines = [...el.querySelectorAll('#grid-lines line')];

      const hourMark = lines.find((l) => l.getAttribute('x1') === '0'); // offset 0
      expect(hourMark.getAttribute('stroke')).toBe('#8f97a3');
      expect(hourMark.hasAttribute('stroke-dasharray')).toBe(false);

      const halfHourMark = lines.find((l) => l.getAttribute('x1') === '60'); // offset 30min * 2px
      expect(halfHourMark.getAttribute('stroke')).toBe('#d8dbe0');
      expect(halfHourMark.getAttribute('stroke-dasharray')).toBe('2,3');

      const plainTick = lines.find((l) => l.getAttribute('x1') === '20'); // offset 10min * 2px
      expect(plainTick.getAttribute('stroke')).toBe('#d8dbe0');
      expect(plainTick.hasAttribute('stroke-dasharray')).toBe(false);
    });

    it('renders 25 hour labels using formatOffsetAsClockTime, wrapping back to the day-boundary time', () => {
      const el = createAxis();
      const labels = [...el.querySelectorAll('#hour-labels text')];
      expect(labels).toHaveLength(25);
      expect(labels[0].textContent).toBe('04:00');
      expect(labels[1].textContent).toBe('05:00');
      expect(labels.at(-1).textContent).toBe('04:00'); // wraps across midnight back to day-boundary
    });

    it('re-renders the grid at the new scale on a zoom change', () => {
      const el = createAxis();

      appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: 2 });

      const lines = [...el.querySelectorAll('#grid-lines line')];
      const secondTick = lines.find((l) => l.getAttribute('x1') !== '0');
      // offset 10min * (PX_PER_MINUTE(2) * zoom(2)) = 40, vs 20 at native zoom
      expect(lines.length).toBe(145);
      expect(el.querySelectorAll('#grid-lines line')[1].getAttribute('x1')).toBe('40');
    });
  });

  describe('svg/gradient dimensions', () => {
    it('sizes the svg and gradient bar to the native width at zoom 1', () => {
      const el = createAxis();
      expect(el.querySelector('svg').getAttribute('width')).toBe('2880'); // 1440min * 2px/min
      expect(el.querySelector('#gradient-bar').getAttribute('width')).toBe('2880');
    });

    it('sizes the svg and gradient bar to the zoomed width on a zoom change', () => {
      const el = createAxis();

      appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: 2 });

      expect(el.querySelector('svg').getAttribute('width')).toBe('5760'); // 1440min * (2*2)px/min
      expect(el.querySelector('#gradient-bar').getAttribute('width')).toBe('5760');
    });
  });

  describe('zoom buttons', () => {
    it('dispatches a zoom-in step on click', () => {
      createAxis();

      document.querySelector('.zoom-in').click();

      expect(appStore.getState().horizontalZoomLevel).toBe(1.25);
    });

    it('dispatches a zoom-out step on click, clamped to the fit-to-viewport minimum', () => {
      appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: 1 });
      createAxis({ containerWidth: 2880 }); // minZoom = 2880 / 2880 = 1, already at the floor

      document.querySelector('.zoom-out').click();

      expect(appStore.getState().horizontalZoomLevel).toBe(1); // unchanged, already at min
    });

    it('clamps a zoom-in step at MAX_ZOOM', () => {
      appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: MAX_ZOOM });
      createAxis();

      document.querySelector('.zoom-in').click();

      expect(appStore.getState().horizontalZoomLevel).toBe(MAX_ZOOM);
    });

    it('disables zoom-in at MAX_ZOOM and zoom-out at the fit-to-viewport minimum', () => {
      appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: MAX_ZOOM });
      const el = createAxis({ containerWidth: 2880 });

      expect(el.querySelector('.zoom-in').disabled).toBe(true);

      appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: 1 });

      expect(el.querySelector('.zoom-in').disabled).toBe(false);
      expect(el.querySelector('.zoom-out').disabled).toBe(true); // minZoom = 2880/2880 = 1
    });
  });

  describe('future overlay', () => {
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
});
