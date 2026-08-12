import { TinyBase } from '../base';
import { Timeline } from '../timeline/timeline';

import './timelineStack.css';

export class TimelineStack extends TinyBase {
  ready = false;
  store = super.getStore();
  timelinesData = GLOBALS.DATA.timeline;
  numTimelines = GLOBALS.DATA.timeline.length
  timelineIndex = 0;

  constructor() {
    super();
  }



  connectedCallback() {

    super.connectedCallback();
    this.assignEventHandlers();
    this.store.subscribe(() => this.updateState());
  }

  updateState() {
    const { currentTimelineIndex } = this.store.getState();
    if (currentTimelineIndex !== this.timelineIndex) {
      this.timelineIndex = currentTimelineIndex
      this.scrollToTimeline();
    }
  }

  scrollToTimeline() {
    const timeline = this.children[this.timelineIndex];
    // get the element
    timeline.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest', // Prevents the whole page from jumping vertically
      inline: 'start'   // Aligns item to the start edge to match CSS snapping
    });

  }

  switchTimeLine(index) {
    if (index === this.timelineIndex) {
      return;
    }
    this.store.dispatch({
      type: 'SWITCH_TIMELINE',
      payload: index,
    });
  }

  assignEventHandlers() {
    if (!this.ready) {
      this.addEventListener("scrollsnapchange", (event) => {
        if (!event.snapTargetInline) {
          console.error('problem getting timeline index from scroll')
          return
        }
        this.switchTimeLine(Number(event.snapTargetInline.index))
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
