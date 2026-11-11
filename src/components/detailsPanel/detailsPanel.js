import '../activityPicker/activityPicker';
import '../timePickerPanel/timePickerPanel';
import { TinyBase } from '../base';
import { HIDE_PANEL, SHOW_PANEL } from '../../store/actionTypes';
import './detailsPanel.css';
import { escapeHtml } from '../../utils/html';
import { guardUnsavedEdits } from '../../utils/unsavedEdits';
import { MIN_ENTRY_DURATION_MINS } from '../timeline/timelineConstants';
import { getDayBoundaryInMinutes } from '../../utils/time';
import { t } from '../../i18n/i18n';
import { DeleteConfirmFlow } from './deleteConfirmFlow';
import { LeavePromptFlow } from './leavePromptFlow';

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
  dayBoundaryInMinutes = getDayBoundaryInMinutes();

  // the two in-panel questions, each its own small state machine (see their
  // files); the panel injects the few things they cannot know
  deleteConfirmFlow = new DeleteConfirmFlow({
    host: this,
    getEntryId: () => this.state.id,
    deleteEntry: (id) => this.props.deleteEntry(id),
    returnFocusTo: () => this.deleteButton.focus(),
  });
  leavePromptFlow = new LeavePromptFlow({
    host: this,
    getIncompleteReasons: () => this.getIncompleteReasons(),
    focusFallback: () => this.focusActivity(),
  });

  timelinePickerPanel;
  // the three observed attributes (set by DetailsPanelCoordinator's
  // applyDimension), carried onto named fields by attributeChangedCallback
  dimensionIndex;
  heading;
  instruction;

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

  // explicit, named fields - not `this[name] = newValue`, which writes
  // stringly-named lowercase properties onto the instance and lets a future
  // observed attribute silently shadow a method
  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case DIMENSION_INDEX:
        this.dimensionIndex = newValue;
        break;
      case HEADING:
        this.heading = newValue;
        break;
      case INSTRUCTION:
        this.instruction = newValue;
        break;
    }
  }

  getChildElementReferences() {
    this.timelinePickerPanel = this.querySelector('el-time-picker-panel');
    this.activityPicker = this.querySelector('el-activity-picker');
    this.saveButton = this.querySelector('.btn-save-btn');
    this.saveHint = this.querySelector('.save-hint');
    this.deleteButton = this.querySelector('.btn-delete-btn');
    this.errorDisplay = this.querySelector('.entry-error');
    this.openCloseButton = this.querySelector('[data-openCloseButton]');
  }

  assignEventHandlers() {
    this.deleteConfirmFlow.bind(this);
    this.leavePromptFlow.bind(this);
    this.saveButton.addEventListener('click', () => this.onSaveButtonClick());
    this.deleteButton.addEventListener('click', () => this.deleteConfirmFlow.begin());
    this.openCloseButton.addEventListener('click', () => {
      if (this.open) {
        this.requestClose();
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
      reasons.push(t('detailsPanel.reason.times'));
    }
    if (!hasActivity) {
      reasons.push(t('detailsPanel.reason.activity'));
    }
    if (
      typeof startOffsetMins === 'number' &&
      typeof endOffsetMins === 'number' &&
      endOffsetMins - startOffsetMins < MIN_ENTRY_DURATION_MINS
    ) {
      reasons.push(t('detailsPanel.reason.minDuration', { minutes: MIN_ENTRY_DURATION_MINS }));
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
      this.saveHint.textContent = reasons.join(t('common.sentenceJoin'));
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
    return this.isDraftUnsaved({ state: this.state, baseline: this.baseline });
  }

  // the same of a parked draft (see getDraft)
  isDraftUnsaved(draft) {
    return (
      Boolean(draft) && draft.baseline !== undefined && this.basisOf(draft.state) !== draft.baseline
    );
  }

  // closes the panel and forgets what was in it, once the guard says nothing
  // unsaved would be lost (Escape and the chevron both come here)
  requestClose() {
    guardUnsavedEdits({}, () => {
      this.store.dispatch({ type: HIDE_PANEL });
      this.reset();
    });
  }

  // --- the unsaved-changes question ---------------------------------------

  // asks what to do with the unsaved edit that something is about to drop
  // (the coordinator's guard calls this) - the question itself is
  // LeavePromptFlow's; only one question shows at a time, so a pending
  // delete confirmation gives way first
  showLeavePrompt(callbacks) {
    this.deleteConfirmFlow.cancel();
    this.leavePromptFlow.show(callbacks);
  }

  // saves the open entry as Save does -> whether it was saved (not if it is
  // incomplete, or the save was refused, e.g. an overlap, which shows why)
  saveDraft() {
    if (!this.isEntryComplete()) return false;
    this.props.saveEntry(this.state);
    return Object.keys(this.state).length === 0; // a save resets the panel
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
    this.deleteConfirmFlow.dismiss();
    this.leavePromptFlow.hide();
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
    this.deleteConfirmFlow.cancel(); // an unanswered question does not wait for the panel to come back
    this.leavePromptFlow.hide();
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
    if (this.leavePromptFlow.isShowing) {
      // Escape answers the question (Keep editing); it does not also close the panel
      e.preventDefault();
      this.leavePromptFlow.answer('onKeep');
      return;
    }
    if (this.deleteConfirmFlow.confirming) {
      // Escape answers the question (Keep it); it does not also close the panel
      e.preventDefault();
      this.deleteConfirmFlow.cancel({ returnFocus: true });
      return;
    }
    if (this.listWasOpenOnEscape) {
      if (this.isActivityListOpen()) {
        this.closeActivityList();
      }
      return;
    }
    this.requestClose();
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
    this.deleteConfirmFlow.cancel(); // a question about the last Entry is not about this one
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
        label: t('timePickerPanel.continue.toNext'),
      };
    }
    return {
      endTimeInMinutes: this.dayBoundaryInMinutes - 1 + 24 * 60,
      label: t('timePickerPanel.continue.toEnd'),
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
                dimensionindex="${this.dimensionIndex}"
                instruction="${escapeHtml(this.instruction)}"
                heading="${escapeHtml(this.heading)}"
                ${this.setProps({ onFocusCallback: () => this.onFocusCallback(), onSetActivityOnSelectedEntry: (activity) => this.onSetActivityOnSelectedEntry(activity), onSetActivitiesOnSelectedEntry: (activities) => this.onSetActivitiesOnSelectedEntry(activities) })}
              ></el-activity-picker>
              <el-time-picker-panel ${this.setProps({ onTimeSet: (setTimeProps) => this.onSetOffsetMins(setTimeProps), getContinueToTarget: (startTimeInMinutes) => this.getContinueToTarget(startTimeInMinutes) })} day-boundary="${this.dayBoundaryInMinutes}"></el-time-picker-panel>
              <div class="entry-error" id="entry-error-${this.instanceId}" aria-live="polite" hidden></div>
              <p class="save-hint" id="save-hint-${this.instanceId}" hidden></p>
              <button class="btn btn-save-btn opaque" aria-disabled="true">${t('detailsPanel.save')}</button>
              <button class="btn btn-delete-btn hide">${t('detailsPanel.delete')}</button>${this.leavePromptFlow.markup(this.instanceId)}${this.deleteConfirmFlow.markup(this.instanceId)}
            </div>
            `;
  }
}

customElements.define('el-details-panel', DetailsPanel);
