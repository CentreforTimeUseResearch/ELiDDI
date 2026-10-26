import { TinyBase } from '../base';
import { PX_PER_MINUTE, MINUTES_PER_DAY, SVGNS } from '../timeline/timelineConstants';
import {
  getCurrentOffsetMins,
  getCurrentDiaryDateKey,
  formatOffsetAsClockTime,
} from '../../utils/time';
import { SET_HORIZONTAL_ZOOM } from '../../store/actionTypes';
import { NATIVE_ZOOM, MAX_ZOOM, ZOOM_STEP, getEffectivePxPerMinute } from './zoomConstants';
import './horizontalTimelineAxis.css';

const FUTURE_OVERLAY_REFRESH_MS = 30000; // matches Timeline.updateFutureOverlay's interval
const AXIS_HEIGHT = 40; // matches #svg-horizontal-timeline-axis's viewBox height in index.html
const GRID_STEP_MINS = 10; // matches the vertical Timeline's own grid-lines resolution
const GRID_TICK_TOP = 28;
const HOUR_LABEL_Y = 14;

// Phase 10.5: the shared, rendered-once time axis (grid ticks, hour labels,
// time-of-day gradient bar, live future-overlay, +/- zoom control) that sits
// above all six HorizontalTimeline rows. Grid/hour-label markup used to be
// static (Phase 10.3) but is now generated here, at 10-minute resolution,
// and regenerated on every zoom change - see zoomConstants.js for the zoom
// range/step, and the Phase 10.5 plan for why re-rendering SVG geometry was
// chosen over a CSS transform:scaleX() approach.
export class HorizontalTimelineAxis extends TinyBase {
  store = super.getStore();
  fragment;
  svgElement;
  gridLinesElement;
  hourLabelsElement;
  gradientBarElement;
  futureOverlayElement;
  zoomInButton;
  zoomOutButton;
  currentDate;
  zoomLevel = NATIVE_ZOOM;

  constructor() {
    super();
    this.fragment = document.getElementById('svg-horizontal-timeline-axis').content.cloneNode(true);
  }

  connectedCallback() {
    const state = this.store.getState();
    this.currentDate = state.currentDate;
    this.zoomLevel = state.horizontalZoomLevel;
    super.connectedCallback();
    this.getChildElementReferences();
    this.assignEventHandlers();
    this.registerCleanup(this.store.subscribe(() => this.updateState()));
    this.renderAxis();
    this.updateFutureOverlay();
    this.updateButtonDisabledState();
    const futureOverlayIntervalId = setInterval(
      this.updateFutureOverlay.bind(this),
      FUTURE_OVERLAY_REFRESH_MS
    );
    this.registerCleanup(() => clearInterval(futureOverlayIntervalId));
  }

  getChildElementReferences() {
    this.svgElement = this.querySelector('svg');
    // parts named with data-part, like the Timelines' templates (#170)
    this.gridLinesElement = this.svgElement.querySelector('[data-part="grid-lines"]');
    this.hourLabelsElement = this.svgElement.querySelector('[data-part="hour-labels"]');
    this.gradientBarElement = this.svgElement.querySelector('[data-part="gradient-bar"]');
    this.futureOverlayElement = this.svgElement.querySelector('[data-part="future-overlay"]');
    this.zoomInButton = this.querySelector('.zoom-in');
    this.zoomOutButton = this.querySelector('.zoom-out');
  }

  assignEventHandlers() {
    this.zoomInButton?.addEventListener('click', () => this.changeZoom(ZOOM_STEP));
    this.zoomOutButton?.addEventListener('click', () => this.changeZoom(-ZOOM_STEP));
  }

  updateState() {
    const state = this.store.getState();
    const dateChanged = state.currentDate !== this.currentDate;
    const zoomChanged = state.horizontalZoomLevel !== this.zoomLevel;
    this.currentDate = state.currentDate;
    this.zoomLevel = state.horizontalZoomLevel;
    if (zoomChanged) {
      this.renderAxis();
      this.updateButtonDisabledState();
    }
    if (dateChanged || zoomChanged) {
      this.updateFutureOverlay();
    }
  }

  // the stack (HorizontalTimelineStack, this element's direct parent) is the
  // overflow-x: auto scroll container - "zoomed all the way out" means the
  // native-scale content (2880px) shrunk to exactly fit its current visible
  // width, so the whole day shows with no horizontal scrollbar
  computeMinZoom() {
    const stack = this.parentElement;
    if (!stack?.clientWidth) {
      return NATIVE_ZOOM; // no real layout (e.g. a test environment) - a sane fallback
    }
    // the stack's Dimension label gutter is not room for the day
    const gutterPx = parseFloat(getComputedStyle(stack).getPropertyValue('--hz-label-width')) || 0;
    const nativeWidthPx = MINUTES_PER_DAY * PX_PER_MINUTE;
    return Math.min((stack.clientWidth - gutterPx) / nativeWidthPx, MAX_ZOOM);
  }

  changeZoom(delta) {
    const minZoom = this.computeMinZoom();
    const nextZoom = Math.min(Math.max(this.zoomLevel + delta, minZoom), MAX_ZOOM);
    if (nextZoom === this.zoomLevel) {
      return;
    }
    this.store.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: nextZoom });
  }

  updateButtonDisabledState() {
    if (this.zoomInButton) {
      this.zoomInButton.disabled = this.zoomLevel >= MAX_ZOOM;
    }
    if (this.zoomOutButton) {
      this.zoomOutButton.disabled = this.zoomLevel <= this.computeMinZoom();
    }
  }

  // updates the svg's own width/viewBox to match the new effective content
  // width and regenerates the grid/hour-labels at that scale - keeps 1
  // viewBox unit = 1 CSS px as an invariant at every zoom level, rather than
  // ever relying on implicit viewBox-stretching (see the Phase 10.5 plan).
  // Also sets this host element's own width to match: a too-wide replaced
  // element (the svg) only visually overflows a width:auto block parent, it
  // doesn't grow the parent's own layout box - without this, the sticky
  // .zoom-controls child's containing block (this element) stays narrower
  // than the real scrollable content and scrolls out of view before the
  // content's actual end is reached.
  renderAxis() {
    const effectivePxPerMinute = getEffectivePxPerMinute(this.zoomLevel);
    const totalWidthPx = MINUTES_PER_DAY * effectivePxPerMinute;
    this.svgElement.setAttribute('viewBox', `0 0 ${totalWidthPx} ${AXIS_HEIGHT}`);
    this.svgElement.setAttribute('width', totalWidthPx);
    this.style.width = `${totalWidthPx}px`;
    this.gradientBarElement.setAttributeNS(null, 'width', totalWidthPx);
    this.renderGrid(effectivePxPerMinute);
  }

  renderGrid(effectivePxPerMinute) {
    this.gridLinesElement.innerHTML = '';
    this.hourLabelsElement.innerHTML = '';

    for (let offset = 0; offset <= MINUTES_PER_DAY; offset += GRID_STEP_MINS) {
      const x = offset * effectivePxPerMinute;
      const isHourMark = offset % 60 === 0;
      const isHalfHourMark = !isHourMark && offset % 30 === 0;

      const line = document.createElementNS(SVGNS, 'line');
      line.setAttributeNS(null, 'x1', x);
      line.setAttributeNS(null, 'x2', x);
      line.setAttributeNS(null, 'y1', GRID_TICK_TOP);
      line.setAttributeNS(null, 'y2', AXIS_HEIGHT);
      line.setAttributeNS(null, 'stroke', isHourMark ? '#8f97a3' : '#d8dbe0');
      line.setAttributeNS(null, 'stroke-width', '1');
      if (isHalfHourMark) {
        line.setAttributeNS(null, 'stroke-dasharray', '2,3');
      }
      this.gridLinesElement.appendChild(line);

      if (isHourMark) {
        const text = document.createElementNS(SVGNS, 'text');
        text.setAttributeNS(null, 'x', x);
        text.setAttributeNS(null, 'y', HOUR_LABEL_Y);
        if (offset === 0) {
          text.setAttribute('text-anchor', 'start');
        } else if (offset === MINUTES_PER_DAY) {
          text.setAttribute('text-anchor', 'end');
        }
        text.textContent = formatOffsetAsClockTime(offset);
        this.hourLabelsElement.appendChild(text);
      }
    }
  }

  updateFutureOverlay() {
    if (!this.futureOverlayElement) {
      return;
    }
    if (this.currentDate !== getCurrentDiaryDateKey()) {
      // "future" only means anything on the actual current diary day - a
      // past (or future) diary date has nothing left to grey out
      this.futureOverlayElement.setAttributeNS(null, 'width', 0);
      return;
    }
    const effectivePxPerMinute = getEffectivePxPerMinute(this.zoomLevel);
    const nowOffsetPx = getCurrentOffsetMins() * effectivePxPerMinute;
    const totalWidthPx = MINUTES_PER_DAY * effectivePxPerMinute;
    this.futureOverlayElement.setAttributeNS(null, 'x', nowOffsetPx);
    this.futureOverlayElement.setAttributeNS(null, 'width', totalWidthPx - nowOffsetPx);
  }

  render() {
    this.appendChild(this.fragment);
    const controls = document.createElement('div');
    controls.className = 'zoom-controls';
    controls.innerHTML = `
      <button type="button" class="reset-to-div zoom-button zoom-out" aria-label="Zoom out">−</button>
      <button type="button" class="reset-to-div zoom-button zoom-in" aria-label="Zoom in">+</button>
    `;
    this.appendChild(controls);
  }
}

customElements.define('el-horizontal-timeline-axis', HorizontalTimelineAxis);
