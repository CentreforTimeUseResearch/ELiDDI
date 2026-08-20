import { ActivityPicker } from '../activityPicker/activityPicker'; // as el-autocomplete
import { TimePickerPanel } from '../timePickerPanel/timePickerPanel';
import { TinyBase } from '../base';
import './detailsPanel.css';

const DIMENSION_INDEX = 'dimensionindex';
const HEADING = 'heading';
const INSTRUCTION = 'instruction';

export class DetailsPanel extends TinyBase {
  static observedAttributes = [DIMENSION_INDEX, HEADING, INSTRUCTION];

  store = super.getStore();
  state = {};
  key;
  props;
  open = false;
  selectedEntry;
  saveButton;
  dayBoundaryInMinutes;
  currentDimensionIndex;

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
    const { currentDimensionIndex } = this.store.getState();
    this.currentDimensionIndex = currentDimensionIndex;
    super.connectedCallback();
    // hand Timeline a small, named set of things it's allowed to do to
    // this panel, instead of it reaching in and calling our methods
    // directly - keeps Timeline decoupled from our actual method names
    this.props.registerPanelActions?.({
      openEntry: (entry) => this.openEntry(entry),
      openNewEntry: (startOffsetMins) => this.openNewEntry(startOffsetMins),
      close: () => this.reset(),
      reportSaveConflict: (message) => this.showError(message),
    });
    this.registerCleanup(this.store.subscribe(this.onStoreUpdate.bind(this)));
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
    this.activityPicker = this.querySelector('el-activity-picker');
    this.saveButton = this.querySelector('.btn-save-btn');
    this.deleteButton = this.querySelector('.btn-delete-btn');
    this.errorDisplay = this.querySelector('.entry-error');
    this.openCloseButton = this.querySelector('[data-openCloseButton]');
  }

  assignEventHandlers() {
    this.saveButton.addEventListener('click', () => this.onSaveButtonClick());
    this.deleteButton.addEventListener('click', () => this.onDeleteButtonClick());
    this.openCloseButton.addEventListener('click', () => {
      if (this.open) {
        this.hidePanel();
      } else {
        this.showPanel();
      }
    });
  }

  isEntryComplete() {
    const hasActivity = Array.isArray(this.state.activity)
      ? this.state.activity.length > 0
      : !!this.state.activity;
    return (
      typeof this.state.startOffsetMins === 'number' &&
      typeof this.state.endOffsetMins === 'number' &&
      hasActivity
    );
  }

  updateState(newState) {
    // any field change is an attempt to fix things, so clear a stale
    // rejection message from a previous save attempt
    this.clearError();
    this.state = newState;
    if (this.isEntryComplete()) {
      this.showSaveButton();
    }
  }

  reset() {
    this.state = {};
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
    this.classList.remove('active');
  }

  // part of the panelActions contract handed to Timeline via
  // registerPanelActions - pre-fills the panel for editing an existing entry
  openEntry(entry) {
    this.setStartTime(entry.startOffsetMins);
    this.setEndTime(entry.endOffsetMins);
    this.setActivity(entry.activity);
    this.setEntryId(entry.id);
  }

  // part of the panelActions contract handed to Timeline via
  // registerPanelActions - clears any leftover state and pre-fills the
  // start time for a brand new entry
  openNewEntry(startOffsetMins) {
    this.reset();
    this.setStartTime(startOffsetMins);
  }

  setStartTime(starttime) {
    this.updateState({
      ...this.state,
      startOffsetMins: starttime,
    });
    this.setTimePanelStartTime();
  }

  setEndTime(endtime) {
    this.updateState({
      ...this.state,
      endOffsetMins: endtime,
    });
    this.setTimePanelEndTime();
  }

  setActivity(activity) {
    this.updateState({
      ...this.state,
      activity,
    });
    this.activityPicker.setInputValue(activity);
    if (Array.isArray(activity)) {
      // pre-fill the picker so previously-selected activities show as pressed
      this.activityPicker.setSelectedActivities(activity);
    }
  }

  setEntryId(id) {
    this.updateState({
      ...this.state,
      id,
    });
    this.showDeleteButton();
  }

  setTimePanelStartTime() {
    if (typeof this.state.startOffsetMins === 'number') {
      this.timelinePickerPanel.setAttribute(
        'start-time',
        this.state.startOffsetMins + this.dayBoundaryInMinutes
      );
    }
  }

  setTimePanelEndTime() {
    if (typeof this.state.endOffsetMins === 'number') {
      this.timelinePickerPanel.setAttribute(
        'end-time',
        this.state.endOffsetMins + this.dayBoundaryInMinutes
      );
    }
  }

  // decides what "continue this activity" should mean given the current
  // start time - continue to the next chronological entry if one exists
  // after this start time, otherwise fall back to the end of the diary day
  getContinueToTarget(startTimeInMinutes) {
    const offsetMins = startTimeInMinutes - this.dayBoundaryInMinutes;
    const nextEntry = this.props.findNextEntryAfter(offsetMins);
    if (nextEntry) {
      return {
        endTimeInMinutes: nextEntry.startOffsetMins + this.dayBoundaryInMinutes,
        label: 'Continue this activity to the next activity',
      };
    }
    return {
      endTimeInMinutes: this.dayBoundaryInMinutes - 1 + 24 * 60,
      label: 'Continue this activity to the end of the day',
    };
  }

  onStoreUpdate() {
    const { uipanel, currentDimensionIndex } = this.store.getState();
    this.currentDimensionIndex = currentDimensionIndex;
    const isMyDimension = Number(this[DIMENSION_INDEX]) === this.currentDimensionIndex;
    const showActivityPanel = uipanel === 'activity';

    if (showActivityPanel) {
      // console.log('hereh')
      this.showPanel();
    } else {
      this.hidePanel();
    }

    if (isMyDimension) {
      this.classList.remove('hide');
    } else {
      this.classList.add('hide');
    }
  }

  onSaveButtonClick() {
    //create a new entry.
    if (!this.isEntryComplete()) return;
    this.props.saveEntry(this.state);
  }

  onDeleteButtonClick() {
    if (this.state.id === undefined) return;
    this.props.deleteEntry(this.state.id);
  }

  showSaveButton() {
    this.saveButton.classList.remove('opaque');
  }

  hideSaveButton() {
    this.saveButton.classList.add('opaque');
  }

  showDeleteButton() {
    this.deleteButton.classList.remove('hide');
  }

  hideDeleteButton() {
    this.deleteButton.classList.add('hide');
  }

  showError(message) {
    this.errorDisplay.textContent = message;
    this.errorDisplay.removeAttribute('hidden');
  }

  clearError() {
    this.errorDisplay.textContent = '';
    this.errorDisplay.setAttribute('hidden', '');
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
      activity,
    });

    this.activityPicker.setInputValue(activity);
  }

  // triggered on every toggle in a multiple-choice picker; popover stays open
  // so the activity picker itself handles its own display, this just tracks state
  onSetActivitiesOnSelectedEntry(activities) {
    this.updateState({
      ...this.state,
      activity: activities,
    });
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
          startOffsetMins: offsetMins,
        });
        break;
    }
  }

  render() {
    if (Number(this[DIMENSION_INDEX]) !== this.currentDimensionIndex) {
      // hide
      this.classList.add('hide');
    } else {
      this.classList.remove('hide');
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
              <el-activity-picker
                dimensionindex="${this[DIMENSION_INDEX]}"
                instruction="${this[INSTRUCTION]}"
                heading="${this[HEADING]}"
                ${this.setProps({ onPopOverShowing: (isPopoverShowing) => this.onPopOverShowing(isPopoverShowing), onFocusCallback: () => this.onFocusCallback(), onSetActivityOnSelectedEntry: (activity) => this.onSetActivityOnSelectedEntry(activity), onSetActivitiesOnSelectedEntry: (activities) => this.onSetActivitiesOnSelectedEntry(activities) })}
              ></el-activity-picker>
              <el-time-picker-panel ${this.setProps({ onTimeSet: (setTimeProps) => this.onSetOffsetMins(setTimeProps), getContinueToTarget: (startTimeInMinutes) => this.getContinueToTarget(startTimeInMinutes) })} day-boundary="${this.dayBoundaryInMinutes}"></el-time-picker-panel>
              <div class="entry-error" aria-live="polite" hidden></div>
              <button class="btn btn-save-btn opaque">Save</button>
              <button class="btn btn-delete-btn hide">Delete</button>
            </div>
            `;
  }
}

customElements.define('el-details-panel', DetailsPanel);
