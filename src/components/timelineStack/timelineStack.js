import { TinyBase } from '../base';
import { Timeline } from '../timeline/timeline';

import './timelineStack.css';

export class TimelineStack extends TinyBase {
  ready = false;
  store = super.getStore();
  timelinesData = GLOBALS.DATA.timeline;
  numTimelines = GLOBALS.DATA.timeline.length

  constructor() {
    super();
  }



  connectedCallback() {
    this.render();
    this.assignEventHandlers();
  }

  assignEventHandlers() {
    if (!this.ready) {

      this.ready = true;
    }
  }

  // switchTimeline(payload) {
  //   this.store.dispatch({
  //     action: 'SWITCH_TIMELINE',
  //     payload,
  //   });
  // }



  render() {
    // this component is a work in progress so this output is for debug purposes
    this.innerHTML = `
            <div class="" style=" ">
            <el-timeline></el-timeline>
            </div>
        `;
  }
}



customElements.define('el-timeline-stack', TimelineStack);
