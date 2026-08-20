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
    const timeline = this.children[this.dimensionIndex];
    // get the element
    // timeline.scrollIntoView({
    //   behavior: 'smooth',
    //   block: 'nearest', // Prevents the whole page from jumping vertically
    //   inline: 'start'   // Aligns item to the start edge to match CSS snapping
    // });
    // this.scrollLeft += 400
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
        if (!event.snapTargetInline) {
          console.error('problem getting dimension index from scroll');
          return;
        }
        this.switchDimension(Number(event.snapTargetInline.index));
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
