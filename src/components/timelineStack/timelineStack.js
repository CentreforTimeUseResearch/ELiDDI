import { TinyBase } from '../base';
import { Timeline } from '../timeline/timeline';
import '../detailsPanel/detailsPanel';
import { DetailsPanelCoordinator } from '../detailsPanel/detailsPanelCoordinator';
import { SWITCH_DIMENSION } from '../../store/actionTypes';

import './timelineStack.css';

// how long the strip must stop moving before the scroll fallback decides which
// Timeline it settled on
const SCROLL_SETTLE_MS = 100;

// The mobile layout: one Timeline per Dimension in a horizontally
// scroll-snapping strip (swipe between Dimensions), and below it the app's
// one details panel (ADR 0005), which a DetailsPanelCoordinator routes to
// the current Dimension's Timeline - the same arrangement as
// HorizontalTimelineStack on desktop.
//
// <el-timeline-stack>
//   <div class="timeline-scroller"> <el-timeline index="0..5"> </div>
//   <el-details-panel>
export class TimelineStack extends TinyBase {
  // its Timelines and panel are built once and kept across a DOM move -
  // see TinyBase.connectedCallback
  static renderOnce = true;
  store = super.getStore();
  timelinesData = GLOBALS.DATA.timeline;
  numTimelines = GLOBALS.DATA.timeline.length;
  dimensionIndex = 0;
  scroller;

  constructor() {
    super();
    this.panelCoordinator = new DetailsPanelCoordinator({
      store: this.store,
      getTimeline: (dimensionIndex) => this.scroller?.children[dimensionIndex],
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this.assignEventHandlers();
    this.registerCleanup(this.store.subscribe(() => this.updateState()));
  }

  updateState() {
    const { currentDimensionIndex } = this.store.getState();
    if (currentDimensionIndex !== this.dimensionIndex) {
      this.dimensionIndex = currentDimensionIndex;
      this.scrollToTimeline();
    }
    this.panelCoordinator.onStoreUpdate();
  }

  scrollToTimeline() {
    this.scroller.scrollLeft =
      this.dimensionIndex * (this.scroller.scrollWidth / this.numTimelines);
  }

  switchDimension(index) {
    if (index === this.dimensionIndex) {
      return;
    }
    this.store.dispatch({
      type: SWITCH_DIMENSION,
      payload: index,
    });
  }

  assignEventHandlers() {
    this.listen(this.scroller, 'scrollsnapchange', (event) => {
      // the attribute, not snapTargetInline.index - that property only
      // exists because Timeline's attributeChangedCallback mirrors the
      // attribute onto the instance. parseInt so a missing attribute
      // (null) is NaN, not Number(null) === 0
      const index = Number.parseInt(event.snapTargetInline?.getAttribute?.('index'), 10);
      if (!Number.isInteger(index)) {
        console.error('problem getting dimension index from scroll');
        return;
      }
      this.switchDimension(index);
    });

    // scrollsnapchange is Chromium-only; elsewhere the CSS scroll-snap still
    // works visually, so work out the settled Timeline from the scroll position
    if (!('onscrollsnapchange' in window)) {
      let settleTimer;
      this.listen(this.scroller, 'scroll', () => {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => this.switchToScrolledTimeline(), SCROLL_SETTLE_MS);
      });
      this.registerCleanup(() => clearTimeout(settleTimer));
    }
  }

  switchToScrolledTimeline() {
    const timelineWidth = this.scroller.scrollWidth / this.numTimelines;
    if (!timelineWidth) {
      return;
    }
    const index = Math.round(this.scroller.scrollLeft / timelineWidth);
    this.switchDimension(Math.min(Math.max(index, 0), this.numTimelines - 1));
  }

  render() {
    this.scroller = document.createElement('div');
    this.scroller.className = 'timeline-scroller';
    this.appendChild(this.scroller);
    for (let i = 0; i < this.numTimelines; i++) {
      const timeline = new Timeline();
      timeline.setAttribute('index', i);
      timeline.setAttribute('key', this.setProps(this.panelCoordinator.timelineProps(i), true));
      this.scroller.appendChild(timeline);
    }
    this.appendChild(
      this.panelCoordinator.createPanel((props, returnKey) => this.setProps(props, returnKey))
    );
  }
}

customElements.define('el-timeline-stack', TimelineStack);
