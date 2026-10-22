import { TinyBase } from '../base';
import { PX_PER_MINUTE, MINUTES_PER_DAY } from '../timeline/timelineConstants';
import { getCurrentOffsetMins, getCurrentDiaryDateKey } from '../../utils/time';
import './horizontalTimelineAxis.css';

const FUTURE_OVERLAY_REFRESH_MS = 30000; // matches Timeline.updateFutureOverlay's interval

// Phase 10.3: the shared, rendered-once time axis (grid ticks, hour labels,
// time-of-day gradient bar, live future-overlay) that sits above all six
// HorizontalTimeline rows - grid/gradient/hour-label markup lives statically
// in index.html's #svg-horizontal-timeline-axis template (see Timeline's own
// #grid-lines/#hour-labels for the precedent); this class only owns the one
// piece that has to update live, axis-swapped from Timeline.updateFutureOverlay.
export class HorizontalTimelineAxis extends TinyBase {
  store = super.getStore();
  fragment;
  futureOverlayElement;
  currentDate;

  constructor() {
    super();
    this.fragment = document.getElementById('svg-horizontal-timeline-axis').content.cloneNode(true);
  }

  connectedCallback() {
    this.currentDate = this.store.getState().currentDate;
    super.connectedCallback();
    this.futureOverlayElement = this.querySelector('#future-overlay');
    this.registerCleanup(this.store.subscribe(() => this.updateState()));
    this.updateFutureOverlay();
    const futureOverlayIntervalId = setInterval(
      this.updateFutureOverlay.bind(this),
      FUTURE_OVERLAY_REFRESH_MS
    );
    this.registerCleanup(() => clearInterval(futureOverlayIntervalId));
  }

  updateState() {
    const { currentDate } = this.store.getState();
    if (currentDate !== this.currentDate) {
      this.currentDate = currentDate;
      this.updateFutureOverlay();
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
    const nowOffsetPx = getCurrentOffsetMins() * PX_PER_MINUTE;
    const totalWidthPx = MINUTES_PER_DAY * PX_PER_MINUTE;
    this.futureOverlayElement.setAttributeNS(null, 'x', nowOffsetPx);
    this.futureOverlayElement.setAttributeNS(null, 'width', totalWidthPx - nowOffsetPx);
  }

  render() {
    this.appendChild(this.fragment);
  }
}

customElements.define('el-horizontal-timeline-axis', HorizontalTimelineAxis);
