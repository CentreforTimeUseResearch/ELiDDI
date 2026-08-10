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
    this.store.subscribe(() => this.updateState());
  }

  updateState() {
    const { currentTimelineIndex } = this.store.getState();
    if (currentTimelineIndex !== this.timelineIndex) {
      this.timelineIndex = currentTimelineIndex
      this.render();
    }
  }

  assignEventHandlers() {
    if (!this.ready) {

      this.ready = true;
    }
  }

  render() {
    this.innerHTML = `
            <div class="" style=" ">
            <el-timeline index="${this.timelineIndex}"></el-timeline>
            </div>
        `;
  }
}



customElements.define('el-timeline-stack', TimelineStack);
