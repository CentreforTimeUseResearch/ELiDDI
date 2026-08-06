import { ActivityPicker } from '../activityPicker/activityPicker'; // as el-autocomplete
import { TimePickerPanel } from '../timePickerPanel/timePickerPanel';
import { TinyBase } from '../base';
import './detailsPanel.css';

export class DetailsPanel extends TinyBase {

  store = super.getStore();
  key;
  props;
  popoverElement;
  open;
  selectedEntry;
  timelinePickerPanel;
  saveButton;
  startTime;
  endTime;
  activity;
  dayBoundaryInMinutes;
  passInintialStartTime = true;

  constructor() {
    super();
    // set day boundary
    const dayBoundary = GLOBALS.DATA.day_boundary;
    const dayBoundaryHours = Number(dayBoundary.split(':')[0]);
    const dayBoundaryMinutes = Number(dayBoundary.split(':')[1]);
    this.dayBoundaryInMinutes = dayBoundaryHours * 60 + dayBoundaryMinutes;
  }

  connectedCallback() {
    super.connectedCallback();
    this.store.subscribe(this.onStateUpdate.bind(this));
    // this.popoverElement = document.getElementById('popover');
    this.timelinePickerPanel = this.querySelector('el-time-picker-panel');
    this.saveButton = this.querySelector('.btn-save-btn')


  }

  showPanel() {
    this.open = true;
    this.classList.add('active');
  }

  hidePanel() {
    this.open = false;
    this.classList.remove('active')
  }

  // destructure selected entry and render in timepicker panel and activity picker
  onStateUpdate() {

    const {
      selectedEntry: { timeline, index } = {},
      timelines,
      uipanel
    } = this.store.getState();


    if (uipanel === 'activity') {
      this.showPanel();
    } else {
      this.hidePanel();
    }

    if (Array.isArray(timelines) && Array.isArray(timelines[timeline])) { // we have a selected entry
      const { startOffsetMins, endOffsetMins, activity } = timelines[timeline][index] || {};  // destructure the selected entry
      this.startOffsetMins = startOffsetMins;
      this.endOffsetMins = endOffsetMins;
      this.activity = activity;
      this.updateElements();
    }
  }


  updateElements() {
    // if the user has clicked the timeline there will be a startOffset
    // pass this to the timeline picker panel to fill in the start time picker
    if (typeof this.startOffsetMins === 'number' && this.passInintialStartTime) {
      this.timelinePickerPanel.setAttribute('start-time', startOffsetMins + this.dayBoundaryInMinutes);
      this.passInintialStartTime = false;
    }


    // if we have all three bits of information the user can submit
    if (startOffsetMins && endOffsetMins && activity) {
      this.saveButton.classList.remove('opaque')
      console.log('we can save this')
    }
  }









  onFocusCallback() {
    this.showPanel();
  }

  // triggered by activity select 
  onSetActivityOnSelectedEntry(activity) {
    const { index, timeline } = this.store.getState().selectedEntry || {};

    if (timeline, index) {
      this.store.dispatch({
        type: 'SET_SELECTED_ENTRY_ACTIVITY',
        timeline_id: timeline,
        selected_id: index,
        activity
      })
    } else {
      // what is there is no selected entry?
      // create entry
      const timelineIndex = this.store.getState().currentTimelineIndex;
      const newId = this.store.getState().timelines[timelineIndex].length

      this.store.dispatch({
        type: "ADD_ENTRY",
        payload: {
          timelineIndex,
          activity,
          id: newId // how do we make an entry
        }
      })

      // state keeps the id and timeline index of the selected entry
      // this means it can be retrieved without having to itterate to find entry with active flag
      this.store.dispatch({
        type: 'SELECT_ENTRY',
        timelineIndex,
        index: newId // how do we make an entry
      })
    }


  }


  // triggered by adding a  valid end time to an entry that has a valid start time
  onSetOffsetMins({ timeField, endTimeInMinutes }) {
    const endOffsetMins = endTimeInMinutes + this.dayBoundaryInMinutes;
    switch (timeField) {
      case 'endTime':
        this.store.dispatch({
          type: "SET_SELECTED_ENTRY_END_OFFSET",
          endOffsetMins: endOffsetMins
        });
        break;
      case 'startTime':
        this.store.dispatch({
          type: "SET_SELECTED_ENTRY_START_OFFSET",
          endOffsetMins: endOffsetMins
        });
        break;
    }
  }

  render() {
    this.innerHTML = `
            <div>
                <button class="reset-to-div right">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="24" height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                  >
                    ${this.open ? `<polyline points="18 15 12 9 6 15"></polyline>` : `<polyline points="6 9 12 15 18 9"></polyline>`}
                  </svg>
                </button>
            </div>
            <el-activityPicker ${this.setProps({ onFocusCallback: () => this.onFocusCallback(), onSetActivityOnSelectedEntry: (activity) => this.onSetActivityOnSelectedEntry(activity) })}></el-activityPicker>
            <el-time-picker-panel ${this.setProps({ onTimeSet: (setTimeProps) => this.onSetOffsetMins(setTimeProps) })} day-boundary="${this.dayBoundaryInMinutes}"></el-time-picker-panel>
            <button disabled class="btn btn-save-btn opaque">Save</button>
            `;
  }
}

customElements.define('details-panel', DetailsPanel);
