import { TinyBase } from '../base';
import { Timeline } from '../timeline/timeline';
import { SWITCH_DIMENSION } from '../../store/actionTypes';

import './timelineStack.css';

export class TimelineStack extends TinyBase {
  ready = false;
  store = super.getStore();
  timelinesData = GLOBALS.DATA.timeline;
  numTimelines = GLOBALS.DATA.timeline.length;
  dimensionIndex = 0;

  constructor() {
    super();
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
  }

  scrollToTimeline() {
    this.scrollLeft = this.dimensionIndex * (this.scrollWidth / this.numTimelines);
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
    if (!this.ready) {
      this.addEventListener('scrollsnapchange', (event) => {
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

      this.ready = true;
    }
  }

  render() {
    for (let i = 0; i < this.numTimelines; i++) {
      const myCustomInstance = new Timeline();
      myCustomInstance.setAttribute('index', i);
      this.appendChild(myCustomInstance);
    }
  }
}

customElements.define('el-timeline-stack', TimelineStack);
