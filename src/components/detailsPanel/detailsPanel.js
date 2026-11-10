import '../activityPicker/activityPicker';
import '../timePickerPanel/timePickerPanel';
import { TinyBase } from '../base';
import { HIDE_PANEL, SHOW_PANEL } from '../../store/actionTypes';
import './detailsPanel.css';
import { escapeHtml } from '../../utils/html';
import { MIN_ENTRY_DURATION_MINS } from '../timeline/timelineConstants';

const DIMENSION_INDEX = 'dimensionindex';
const HEADING = 'heading';
const INSTRUCTION = 'instruction';

// each panel's description elements get their own ids (aria-describedby needs
// ids, and a page, or a test, may hold more than one panel)
let instanceCount = 0;

export class DetailsPanel extends TinyBase {
  static observedAttributes = [DIMENSION_INDEX, HEADING, INSTRUCTION];

  store = super.getStore();
  state = {};
  key;
  props;
  open = false;
  instanceId = ++instanceCount;
  baseline; // what the panel was opened with, to tell when something is unsaved
  saveButton;
  saveHint;
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
    // hand Timeline a small, named set of things it's allowed to do to
    // this panel, instead of it reaching in and calling our methods
    // directly - keeps Timeline decoupled from our actual method names
    this.props.registerPanelActions?.({
      openEntry: (entry) => this.openEntry(entry),
      openNewEntry: (startOffsetMins, endOffsetMins) =>
        this.openNewEntry(startOffsetMins, endOffsetMins),
      close: () => this.reset(),
      hasUnsavedEdits: () => this.hasUnsavedEdits(),
      reportSaveConflict: (message) => this.showError(message),
      focus: () => this.focusActivity(),
    });
    // Escape closes the activity list if that is open, else the panel. The
    // capture listener notes whether the list was open before the list's
    // own Escape handling runs; the bubble one then acts
    this.listen(this, 'keydown', (e) => this.noteListOpen(e), true);
    this.listen(this, 'keydown', (e) => this.onKeyDown(e));
    this.registerCleanup(this.store.subscribe(this.onStoreUpdate.bind(this)));
    this.getChildElementReferences();
    this.assignEventHandlers();
    this.updateSaveState();
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
    this.saveHint = this.querySelector('.save-hint');
    this.deleteButton = this.querySelector('.btn-delete-btn');
    this.errorDisplay = this.querySelector('.entry-error');
    this.openCloseButton = this.querySelector('[data-openCloseButton]');
  }

  assignEventHandlers() {
    this.saveButton.addEventListener('click', () => this.onSaveButtonClick());
    this.deleteButton.addEventListener('click', () => this.onDeleteButtonClick());
    this.openCloseButton.addEventListener('click', () => {
      if (this.open) {
        this.store.dispatch({
          type: HIDE_PANEL,
        });
      } else {
        this.store.dispatch({
          type: SHOW_PANEL,
          payload: 'details',
        });
      }
    });
  }

  isEntryComplete() {
    const hasActivity = Array.isArray(this.state.activity)
      ? this.state.activity.length > 0
      : !!this.state.activity;
    const { startOffsetMins, endOffsetMins } = this.state;
    return (
      typeof startOffsetMins === 'number' &&
      typeof endOffsetMins === 'number' &&
      endOffsetMins - startOffsetMins >= MIN_ENTRY_DURATION_MINS &&
      hasActivity
    );
  }

  // why the entry cannot be saved yet, as phrases (none when it can)
  getIncompleteReasons() {
    const { startOffsetMins, endOffsetMins } = this.state;
    const reasons = [];
    const hasActivity = Array.isArray(this.state.activity)
      ? this.state.activity.length > 0
      : !!this.state.activity;
    if (typeof startOffsetMins !== 'number' || typeof endOffsetMins !== 'number') {
      reasons.push('Choose a start and end time');
    }
    if (!hasActivity) {
      reasons.push('Choose an activity');
    }
    if (
      typeof startOffsetMins === 'number' &&
      typeof endOffsetMins === 'number' &&
      endOffsetMins - startOffsetMins < MIN_ENTRY_DURATION_MINS
    ) {
      reasons.push(`An entry must last at least ${MIN_ENTRY_DURATION_MINS} minutes`);
    }
    return reasons;
  }

  updateState(newState) {
    // any field change is an attempt to fix things, so clear a stale
    // rejection message from a previous save attempt
    this.clearError();
    this.state = newState;
    this.updateSaveState();
  }

  // Save is on or off (both ways: an Entry can become incomplete again, e.g.
  // shortened below the minimum duration (#162)), and when it is off, the
  // reason is text beside it, tied to it
  updateSaveState() {
    const reasons = this.getIncompleteReasons();
    if (reasons.length === 0) {
      this.showSaveButton();
    } else {
      this.hideSaveButton();
    }
    if (this.saveHint) {
      this.saveHint.textContent = reasons.join('. ');
      this.saveHint.toggleAttribute('hidden', reasons.length === 0);
    }
    this.updateSaveDescription();
  }

  // Save is described by the reason it is off, and by the panel's message while
  // that has something to say (a save conflict)
  updateSaveDescription() {
    if (!this.saveButton) {
      return;
    }
    const described = [this.saveHint, this.errorDisplay]
      .filter((element) => element && !element.hasAttribute('hidden'))
      .map((element) => element.id);
    if (described.length > 0) {
      this.saveButton.setAttribute('aria-describedby', described.join(' '));
    } else {
      this.saveButton.removeAttribute('aria-describedby');
    }
  }

  // --- unsaved edits ----------------------------------------------------

  // the part of the panel's state that the Respondent can change, in a form
  // that compares: several activities are a set (the order they were picked in
  // does not matter), and none, an empty one and an empty list are the same
  basisOf({ startOffsetMins, endOffsetMins, activity }) {
    const chosen = Array.isArray(activity) ? [...activity].sort() : activity ? [activity] : [];
    return JSON.stringify([startOffsetMins, endOffsetMins, chosen]);
  }

  // whether the panel holds something changed that has not been saved. What it
  // was opened with is the baseline: an Entry as stored, or the start and end of
  // a block just made. A block dragged out and given nothing else is not
  // unsaved - nothing the Respondent chose would be lost
  hasUnsavedEdits() {
    return this.baseline !== undefined && this.basisOf(this.state) !== this.baseline;
  }

  // the panel's state and what it was opened with, to park while another
  // Dimension is current -> undefined when nothing is open
  getDraft() {
    if (Object.keys(this.state).length === 0) {
      return undefined;
    }
    return { state: { ...this.state }, baseline: this.baseline };
  }

  restoreDraft({ state, baseline }) {
    if (typeof state.startOffsetMins === 'number') this.setStartTime(state.startOffsetMins);
    if (typeof state.endOffsetMins === 'number') this.setEndTime(state.endOffsetMins);
    if (state.activity !== undefined) this.setActivity(state.activity);
    if (state.id !== undefined) this.setEntryId(state.id);
    this.baseline = baseline;
  }

  reset() {
    this.state = {};
    this.baseline = undefined;
    this.render();
    this.getChildElementReferences();
    this.assignEventHandlers();
    this.updateSaveState();
  }

  showPanel() {
    this.open = true;
    this.classList.add('active');
  }

  hidePanel() {
    this.open = false;
    this.classList.remove('active');
  }

  // keyboard: the way in after opening an Entry from a Timeline
  focusActivity() {
    this.querySelector('[role="combobox"]')?.focus();
  }

  noteListOpen(e) {
    if (e.key === 'Escape') {
      this.listWasOpenOnEscape = this.isActivityListOpen();
    }
  }

  // Escape closes the panel, like its close button - unless the activity list
  // was open, when that Escape is for closing the list (which the list does
  // for itself when it was opened by typing, but not when opened by focus)
  onKeyDown(e) {
    if (e.key !== 'Escape' || !this.open) {
      return;
    }
    if (this.listWasOpenOnEscape) {
      if (this.isActivityListOpen()) {
        this.closeActivityList();
      }
      return;
    }
    this.store.dispatch({ type: HIDE_PANEL });
  }

  closeActivityList() {
    try {
      this.activityPicker?.hidePopover();
    } catch {
      // no Popover API (e.g. jsdom): nothing to close
    }
  }

  isActivityListOpen() {
    try {
      return Boolean(this.querySelector('[popover]')?.matches(':popover-open'));
    } catch {
      return false; // no Popover API (e.g. jsdom): never open
    }
  }

  // part of the panelActions contract handed to Timeline via
  // registerPanelActions - pre-fills the panel for editing an existing entry
  openEntry(entry) {
    this.setStartTime(entry.startOffsetMins);
    this.setEndTime(entry.endOffsetMins);
    this.setActivity(entry.activity);
    this.setEntryId(entry.id);
    this.baseline = this.basisOf(this.state);
  }

  // part of the panelActions contract handed to Timeline via
  // registerPanelActions - clears any leftover state and pre-fills the
  // start and end times for a brand new entry (one slot long if no end is given)
  openNewEntry(startOffsetMins, endOffsetMins = startOffsetMins + 10) {
    this.reset();
    this.setStartTime(startOffsetMins);
    this.setEndTime(endOffsetMins);
    this.baseline = this.basisOf(this.state);
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

  // there's one panel, always for the current Dimension - its stack
  // retargets it (DetailsPanelCoordinator), so it only follows open/closed
  onStoreUpdate() {
    if (this.store.getState().uipanel === 'details') {
      this.showPanel();
    } else {
      this.hidePanel();
    }
  }

  // a rapid double-click/double-activation of this button cannot save
  // twice: Timeline.saveEntry() calls back into this.reset() synchronously
  // (via panelActions.close()) before this click's handler returns, which
  // clears `this.state` - so even a second click already queued on this
  // exact button sees an empty state and bails out below. This only holds
  // because saveEntry's whole commit path is synchronous end-to-end; don't
  // make any of it async without re-checking this guarantee.
  onSaveButtonClick() {
    //create a new entry.
    if (!this.isEntryComplete()) {
      this.focusFirstProblem();
      return;
    }
    this.props.saveEntry(this.state);
  }

  // Save does nothing when the entry is not complete, but pressing it takes
  // the Respondent to what needs doing: the activity, else the time that is wrong
  focusFirstProblem() {
    const { startOffsetMins, endOffsetMins } = this.state;
    const timesMissing = typeof startOffsetMins !== 'number' || typeof endOffsetMins !== 'number';
    const hasActivity = Array.isArray(this.state.activity)
      ? this.state.activity.length > 0
      : !!this.state.activity;
    if (timesMissing) {
      this.querySelector('el-time-picker[input-id="startTime"] input')?.focus();
    } else if (!hasActivity) {
      this.focusActivity();
    } else {
      this.querySelector('el-time-picker[input-id="endTime"] input')?.focus();
    }
  }

  onDeleteButtonClick() {
    if (this.state.id === undefined) return;
    this.props.deleteEntry(this.state.id);
  }

  showSaveButton() {
    this.saveButton.classList.remove('opaque');
    this.saveButton.removeAttribute('aria-disabled');
  }

  // aria-disabled, not disabled: a disabled button cannot be focused, so a
  // keyboard user could never reach it to find out why
  hideSaveButton() {
    this.saveButton.classList.add('opaque');
    this.saveButton.setAttribute('aria-disabled', 'true');
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
    this.updateSaveDescription();
  }

  clearError() {
    this.errorDisplay.textContent = '';
    this.errorDisplay.setAttribute('hidden', '');
    this.updateSaveDescription();
  }

  onFocusCallback() {
    this.showPanel();
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
    // a clock time earlier than the day boundary (01:00 with a 04:00
    // boundary) is the end of this diary day, not before its start
    let offsetMins = timeInMinutes - this.dayBoundaryInMinutes;
    if (offsetMins < 0) {
      offsetMins += 24 * 60;
    }

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
                instruction="${escapeHtml(this[INSTRUCTION])}"
                heading="${escapeHtml(this[HEADING])}"
                ${this.setProps({ onFocusCallback: () => this.onFocusCallback(), onSetActivityOnSelectedEntry: (activity) => this.onSetActivityOnSelectedEntry(activity), onSetActivitiesOnSelectedEntry: (activities) => this.onSetActivitiesOnSelectedEntry(activities) })}
              ></el-activity-picker>
              <el-time-picker-panel ${this.setProps({ onTimeSet: (setTimeProps) => this.onSetOffsetMins(setTimeProps), getContinueToTarget: (startTimeInMinutes) => this.getContinueToTarget(startTimeInMinutes) })} day-boundary="${this.dayBoundaryInMinutes}"></el-time-picker-panel>
              <div class="entry-error" id="entry-error-${this.instanceId}" aria-live="polite" hidden></div>
              <p class="save-hint" id="save-hint-${this.instanceId}" hidden></p>
              <button class="btn btn-save-btn opaque" aria-disabled="true">Save</button>
              <button class="btn btn-delete-btn hide">Delete</button>
            </div>
            `;
  }
}

customElements.define('el-details-panel', DetailsPanel);
