import { ActivityPicker } from '../activityPicker/activityPicker'; // as el-autocomplete
import { TimePickerPanel } from '../timePickerPanel/timePickerPanel';
import { TinyBase } from '../base';
import './detailsPanel.css';

export class DetailsPanel extends TinyBase {

  store = super.getStore();
  state = {};
  key;
  props;
  open;
  selectedEntry;
  saveButton;
  dayBoundaryInMinutes;

  timelinePickerPanel;
  popoverElement;

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
    this.store.subscribe(this.onStoreUpdate.bind(this));
    // this.popoverElement = document.getElementById('popover');
    this.timelinePickerPanel = this.querySelector('el-time-picker-panel');
    this.activityPicker = this.querySelector('el-activityPicker')
    this.saveButton = this.querySelector('.btn-save-btn')
    this.assignEventHandlers();
  }

  assignEventHandlers() {
    this.saveButton.addEventListener('click', () => this.onSaveButtonClick())
  }


  isEntryComplete() {
    return typeof this.state.startOffsetMins === 'number' && typeof this.state.endOffsetMins === 'number' && this.state.activity
  }

  updateState(newState) {
    this.state = newState;
    if (this.isEntryComplete()) {
      this.showSaveButton();
    }
  }


  showPanel() {
    this.open = true;
    this.classList.add('active');
  }

  hidePanel() {
    this.open = false;
    this.classList.remove('active')
  }

  setStartTime(starttime) {
    this.startOffsetMins = starttime;
    this.updateState({
      ...this.state,
      startOffsetMins: starttime
    })
    this.setTimePanelStartTime();
  }

  setTimePanelStartTime() {
    if (typeof this.state.startOffsetMins === 'number') {
      this.timelinePickerPanel.setAttribute('start-time', this.state.startOffsetMins + this.dayBoundaryInMinutes);
      this.passInintialStartTime = false;
    }
  }


  onStoreUpdate() {
    const { uipanel } = this.store.getState();
    if (uipanel === 'activity') {
      this.showPanel();
    } else {
      this.hidePanel();
    }
  }

  onSaveButtonClick() {
    //create a new entry.
    if (!this.isEntryComplete()) return;
    this.props.saveEntry(this.state)
  }

  showSaveButton() {
    this.saveButton.classList.remove('opaque')
  }

  hideSaveButton() {
    this.saveButton.classList.add('opaque');
  }

  onFocusCallback() {
    this.showPanel();
  }


  // getTimelineIndex() {
  //   return this.store.getState().selectedEntry || {};
  // }

  // getSelectedEntryId(timelineIndex) {
  //   return this.store.getState().timelines[timelineIndex].length;
  // }

  // triggered by activity select 
  onSetActivityOnSelectedEntry(activity) {

    this.updateState({
      ...this.state,
      activity
    });

    this.activityPicker.setInputValue(activity)

    // if (timeline, index) {
    //   this.store.dispatch({
    //     type: 'SET_ENTRY_ACTIVITY',
    //     timeline_id: timeline,
    //     selected_id: index,
    //     activity
    //   })
    // } else {
    // what is there is no selected entry?
    // create entry
    // const timelineIndex = this.store.getState().currentTimelineIndex;
    // const newId = this.getSelectedEntryId(timelineIndex)

    // this.store.dispatch({
    //   type: "ADD_ENTRY",
    //   payload: {
    //     timelineIndex,
    //     activity,
    //     id: newId // how do we make an entry
    //   }
    // })

    // // state keeps the id and timeline index of the selected entry
    // // this means it can be retrieved without having to itterate to find entry with active flag
    // this.store.dispatch({
    //   type: 'SELECT_ENTRY',
    //   timelineIndex,
    //   index: newId // how do we make an entry
    // })
    // }


  }


  // triggered by adding a  valid end time to an entry that has a valid start time
  onSetOffsetMins({ timeField, timeInMinutes }) {

    const offsetMins = timeInMinutes - this.dayBoundaryInMinutes;

    switch (timeField) {
      case 'endTime':
        this.updateState({
          ...this.state,
          endOffsetMins: offsetMins,
        });
        break;
      case 'startTime':
        this.updateState({
          ...this.state,
          startOffsetMins: offsetMins
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
            <button class="btn btn-save-btn opaque">Save</button>
            `;
  }
}

customElements.define('details-panel', DetailsPanel);
