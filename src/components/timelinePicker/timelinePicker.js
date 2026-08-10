import { TinyBase } from '../base';
import './timelinePicker.css';

export class TimelinePicker extends TinyBase {
  ready = false;
  timelines;
  timelinePicker;
  store = super.getStore();

  constructor() {
    super();
    this.parseTimelinesFromData();
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
    this.render();
    this.assignEventHandlers();
  }

  assignEventHandlers() {
    if (!this.ready) {
      this.timelinePicker = this.querySelector('[data-timeline-picker]');
      this.timelinePicker?.addEventListener('change', (e) => {
        e.stopPropagation();
        this.switchTimeline(Number(e.target.value))
      });

      this.ready = true;
    }
  }

  switchTimeline(payload) {
    if (typeof payload !== "number") {
      console.error('Problem with timeline picker value');
      return;
    }

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
      .map((timelineName, index) => `<option value=${index}>${timelineName}</option>`)
      .join('');
  }

  render() {
    // this component is a work in progress so this output is for debug purposes
    this.innerHTML = `
            <div class="el-form-group width-adjust">
                <select 
                  class="el-select" 
                  data-timeline-picker
                  name="timeline-picker" 
                  aria-describedby="timeline-picker-hint"
                >
                    <option value="choose" selected>Choose timeline</option>
                    ${this.createOptions()}
                </select>
            </div>
        `;
  }
}

customElements.define('el-timeline-picker', TimelinePicker);
