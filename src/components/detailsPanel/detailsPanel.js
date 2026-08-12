import { ActivityPicker } from '../activityPicker/activityPicker'; // as el-autocomplete
import { TimePickerPanel } from '../timePickerPanel/timePickerPanel';
import { TinyBase } from '../base';
import './detailsPanel.css';

const TIME_LINE_INDEX = 'timelineindex';
const HEADING = 'heading';
const INSTRUCTION = 'instruction'

export class DetailsPanel extends TinyBase {
  static observedAttributes = [TIME_LINE_INDEX, HEADING, INSTRUCTION];

  store = super.getStore();
  state = {};
  key;
  props;
  open = false;
  selectedEntry;
  saveButton;
  dayBoundaryInMinutes;
  currentTimelineIndex;

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
    const { currentTimelineIndex } = this.store.getState();
    this.currentTimelineIndex = currentTimelineIndex;
    super.connectedCallback();
    this.store.subscribe(this.onStoreUpdate.bind(this));
    this.getChildElementReferences();
    this.assignEventHandlers();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this[name] !== newValue) {
      this[name] = newValue;
    }
  }

  getChildElementReferences() {
    // this.popoverElement = document.getElementById('popover');
    this.timelinePickerPanel = this.querySelector('el-time-picker-panel');
    this.activityPicker = this.querySelector('el-activityPicker')
    this.saveButton = this.querySelector('.btn-save-btn')
    this.openCloseButton = this.querySelector('[data-openCloseButton]');
  }

  assignEventHandlers() {
    this.saveButton.addEventListener('click', () => this.onSaveButtonClick())
    this.openCloseButton.addEventListener('click', () => {
      if (this.open) {
        this.hidePanel()
      } else {
        this.showPanel()
      }
    })
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

  reset() {
    this.state = {}
    this.render();
    this.getChildElementReferences();
    this.assignEventHandlers();
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
    this.updateState({
      ...this.state,
      startOffsetMins: starttime
    })
    this.setTimePanelStartTime();
  }


  setEndTime(endtime) {
    this.updateState({
      ...this.state,
      endOffsetMins: endtime
    })
    this.setTimePanelEndTime();
  }

  setActivity(activity) {
    this.updateState({
      ...this.state,
      activity
    })
    this.activityPicker.setInputValue(activity)
  }


  setTimePanelStartTime() {
    if (typeof this.state.startOffsetMins === 'number') {
      this.timelinePickerPanel.setAttribute('start-time', this.state.startOffsetMins + this.dayBoundaryInMinutes);
    }
  }

  setTimePanelEndTime() {
    if (typeof this.state.endOffsetMins === 'number') {
      this.timelinePickerPanel.setAttribute('end-time', this.state.endOffsetMins + this.dayBoundaryInMinutes);
    }
  }


  onStoreUpdate() {
    const { uipanel, currentTimelineIndex } = this.store.getState();
    this.currentTimelineIndex = currentTimelineIndex
    const isMyTimeline = Number(this[TIME_LINE_INDEX]) === this.currentTimelineIndex
    const showActivityPanel = uipanel === 'activity'

    if (showActivityPanel) {
      this.showPanel();
    } else {
      this.hidePanel();
    }

    if (isMyTimeline) {
      this.classList.remove('hide');
    } else {
      this.classList.add('hide')
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

  onPopOverShowing(isPopoverShowing) {
    // leave for now
    // if (isPopoverShowing) {
    //   this.classList.add('higher')
    // } else {
    //   this.classList.remove('higher')
    // }
  }

  // triggered by activity select 
  onSetActivityOnSelectedEntry(activity) {

    this.updateState({
      ...this.state,
      activity
    });

    this.activityPicker.setInputValue(activity)

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
    if (Number(this[TIME_LINE_INDEX]) !== this.currentTimelineIndex) {
      // hide
      this.classList.add('hide')
    } else {
      this.classList.remove('hide')
      //show
    }

    this.innerHTML = `
            <div>
                <button class="reset-to-div right" data-openCloseButton>
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="24" height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                  >
                    <polyline points="18 15 12 9 6 15"></polyline>
                  </svg>
                </button>
            </div>
            <div class="details-panel-content">
              <el-activityPicker 
                instruction="${this[INSTRUCTION]}" 
                heading="${this[HEADING]}" 
                ${this.setProps({ onPopOverShowing: (isPopoverShowing) => this.onPopOverShowing(isPopoverShowing), onFocusCallback: () => this.onFocusCallback(), onSetActivityOnSelectedEntry: (activity) => this.onSetActivityOnSelectedEntry(activity) })}
              ></el-activityPicker>
              <el-time-picker-panel ${this.setProps({ onTimeSet: (setTimeProps) => this.onSetOffsetMins(setTimeProps) })} day-boundary="${this.dayBoundaryInMinutes}"></el-time-picker-panel>
              <button class="btn btn-save-btn opaque">Save</button>
            </div>
            `;

  }
}

customElements.define('details-panel', DetailsPanel);
