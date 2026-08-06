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
  dayBoundary = GLOBALS.DATA.day_boundary;
  dayBoundaryHours = Number(this.dayBoundary.split(':')[0]);
  dayBoundaryMinutes = Number(this.dayBoundary.split(':')[1]);
  dayBoundaryInMinutes = this.dayBoundaryHours * 60 + this.dayBoundaryMinutes;


  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.store.subscribe(this.onStateUpdate.bind(this));
    this.popoverElement = document.getElementById('popover');
    this.timelinePickerPanel = this.querySelector('el-time-picker-panel')
  }

  showPanel() {
    this.open = true;
    this.classList.add('active');
  }

  hidePanel() {
    this.open = false;
    this.classList.remove('active')
  }


  onStateUpdate() {

    const {
      selectedEntry: { timeline, index } = {},
      timelines,
      uipanel
    } = this.store.getState();


    if (Array.isArray(timelines) && Array.isArray(timelines[timeline])) {
      const { startOffsetMins, endOffsetMins, activity } = timelines[timeline][index] || {};

      if (typeof startOffsetMins === 'number') {
        this.timelinePickerPanel.setAttribute('start-time', startOffsetMins + this.dayBoundaryInMinutes)
      }

      if (startOffsetMins && endOffsetMins && activity) {
        console.log('we can save this')
      }
    }

    if (uipanel === 'activity') {
      this.showPanel();
    } else {
      this.hidePanel();
    }





  }

  onFocusCallback() {
    this.showPanel();
  }

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
            <el-time-picker-panel day-boundary="${this.dayBoundaryInMinutes}"></el-time-picker-panel>
            `;
  }
}

customElements.define('details-panel', DetailsPanel);
