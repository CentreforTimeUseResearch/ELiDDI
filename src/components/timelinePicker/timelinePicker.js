import { TinyBase } from '../base';
import './timelinePicker.css';

export class TimelinePicker extends TinyBase {

  timelines;
  timelinePicker;
  store = super.getStore();
  currentTimelineIndex = 0;

  constructor() {
    super();
    this.parseTimelinesFromData();
    this.store.subscribe(() => this.update());
  }

  parseTimelinesFromData() {
    const timelinesData = GLOBALS.DATA.timeline;
    if (!Array.isArray(timelinesData)) {
      console.error('invalid timeline array');
      return;
    }
    this.timelines = timelinesData.map((timeline) => timeline.name);
  }

  connectedCallback() {
    super.connectedCallback();
  }

  assignEventHandlers() {

    this.timelinePicker = this.querySelector('[data-timeline-picker]');
    this.timelinePicker?.addEventListener('change', (e) => {
      e.stopPropagation();
      this.switchTimeline(Number(e.target.value))
    });


  }

  update() {
    const { currentTimelineIndex } = this.store.getState();
    if (this.currentTimelineIndex !== currentTimelineIndex) {

      this.currentTimelineIndex = currentTimelineIndex;
      this.render();
    }
  }

  switchTimeline(payload) {
    if (typeof payload !== "number") {
      console.error('Problem with timeline picker value');
      return;
    }

    this.store.dispatch({
      type: 'HIDE_PANEL'
    })

    this.store.dispatch({
      type: 'SWITCH_TIMELINE',
      payload,
    });

  }

  createOptions() {
    if (!Array.isArray(this.timelines)) {
      console.error('problem in timeline picker ');
      return;
    }
    return this.timelines
      .map((timelineName, index) => `<option value=${index} ${index === this.currentTimelineIndex ? 'selected' : ''}>${timelineName} timeline</option>`)
      .join('');
  }

  render() {
    // this component is a work in progress so this output is for debug purposes
    this.innerHTML = `
            <div class="el-form-group width-adjust">
               <!-- <label class="el-label" for="timeline-picker">Choose timeline:</label> -->
                <select 
                  id="timeline-picker"
                  class="el-select" 
                  data-timeline-picker
                  name="timeline-picker" 
                  aria-describedby="timeline-picker-hint"
                >
                    
                    ${this.createOptions()}
                </select>
            </div>
        `;
    this.assignEventHandlers();
  }
}

customElements.define('el-timeline-picker', TimelinePicker);
