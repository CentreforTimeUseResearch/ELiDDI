import '../timePicker/timePicker';
import '../durationInput/durationInput';
import { TinyBase } from '../base';
import { getMaxEditableTimeInMinutes } from '../../utils/time';
import './timePickerPanel.css';

const DAY_BOUNDARY = 'day-boundary';
const START_TIME = 'start-time';
const END_TIME = 'end-time';

// Times here are minutes, and 0 is a real value in both units the panel
// carries: clock time 00:00 (the first minute of a study whose day boundary
// is midnight) and a zero duration. So "is it set?" is Number.isFinite,
// never truthiness.
const isSet = (minutes) => Number.isFinite(minutes);

// a value="…" attribute for the template, or nothing at all when unset -
// never the literal text "undefined"
const valueAttribute = (value) => (value === undefined ? '' : `value="${value}"`);

// setAttribute, or removeAttribute when there's no value
function setOrRemoveAttribute(element, name, value) {
  if (value === undefined || value === '') {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, value);
  }
}

export class TimePickerPanel extends TinyBase {
  static observedAttributes = [DAY_BOUNDARY, START_TIME, END_TIME];

  store = super.getStore();
  startInputMinutes;
  endInputMinutes;
  durationInputMinutes;

  startInputElement;
  endInputElement;
  restOfDayElement;
  durationInputElement;
  endofday = false;
  dayBoundaryInMinutes;

  endTimeError = '';

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    // this.store.subscribe(()=>this.onStateUpdate()));
    this.assignEventHandlers();
  }

  assignEventHandlers() {
    this.startInputElement = this.querySelector('[input-id="startTime"]');
    this.endInputElement = this.querySelector('[input-id="endTime"]');
    this.durationInputElement = this.querySelector('[data-id="duration"]');
    this.restOfDayElement = this.querySelector('#timepicker-rest-of-day');
    this.restOfDayLabelElement = this.querySelector('label[for="timepicker-rest-of-day"]');

    this.restOfDayElement.addEventListener('change', (e) => this.handleRestOfDayCheckboxClick(e));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this[name] !== newValue) {
      this[name] = newValue;
    }
    // a removed attribute (null) is not a time - Number(null) would read as 00:00
    if (name === START_TIME && newValue !== null) {
      this.onTimeInputChange('startTime', newValue);
    }
    if (name === END_TIME && newValue !== null) {
      this.onTimeInputChange('endTime', newValue);
    }
    if (name === DAY_BOUNDARY) {
      this.dayBoundaryInMinutes = Number(this[DAY_BOUNDARY]) - 1 + 24 * 60;
    }
  }

  // HH:MM, or undefined for an unset time
  formatIfSet(minutes) {
    return isSet(minutes) ? this.convertMinutesToTimePickerFormat(minutes) : undefined;
  }

  convertMinutesToTimePickerFormat(minutes) {
    let timeInMinutes = minutes;
    if (timeInMinutes >= 24 * 60) {
      timeInMinutes = minutes - 24 * 60;
    }

    const hours = String(Math.floor(timeInMinutes / 60)).padStart(2, '0');
    const mins = String(timeInMinutes % 60).padStart(2, '0');

    return `${hours}:${mins}`;
  }

  // latest editable clock time for Start/End time, as an HH:MM string - or
  // undefined if today isn't the diary day currently being edited, in
  // which case there's no "future" to restrict
  getMaxEditableTime() {
    const { currentDate } = this.store.getState();
    const maxMinutes = getMaxEditableTimeInMinutes(currentDate, Number(this[DAY_BOUNDARY]));
    return maxMinutes === undefined ? undefined : this.convertMinutesToTimePickerFormat(maxMinutes);
  }

  // Split HH:mm string and convert to total minutes
  convertTimePickerFormatToMinutes(hhmmstringformat) {
    const [hours, minutes] = hhmmstringformat.split(':').map(Number);
    return hours * 60 + minutes;
  }

  handleRestOfDayCheckboxClick(e) {
    if (e.target.checked) {
      this.endofday = true;
      const target = this.props.getContinueToTarget(this.startInputMinutes);
      this.onTimeInputChange('endTime', target.endTimeInMinutes);
    } else {
      this.endofday = false;
      this.render();
      this.endInputElement.querySelector('input').focus();
    }
  }

  recalculateDuration(startTotalMinutes, endTotalMinutes) {
    // Handle though midnight events (e.g., 22:00 to 02:00 next day)
    if (endTotalMinutes < startTotalMinutes) {
      endTotalMinutes += 24 * 60; // Add 24 hours in minutes
    }

    const endDayBoundaryInMinutes = Number(this[DAY_BOUNDARY]) - 1 + 24 * 60;

    /* don't let the end time be beyond the end day boundary - recomputed
       on every change, so the message clears once the times are valid */
    this.endTimeError =
      endTotalMinutes > endDayBoundaryInMinutes
        ? `End time can't be between ${GLOBALS.DATA.day_boundary} and ${this.convertMinutesToTimePickerFormat(this.startInputMinutes)}`
        : '';

    // store total difference in minutes
    this.durationInputMinutes = endTotalMinutes - startTotalMinutes;
  }

  recalculateEndTime(startTotalMinutes, durationTotalMinutes) {
    const endMinutes = Number(startTotalMinutes) + Number(durationTotalMinutes);
    // we need to check that end minutes is not later that 3.59am
    this.endInputMinutes = endMinutes;
    this.endInputElement.setAttribute('value', this.convertMinutesToTimePickerFormat(endMinutes));
    this.props.onTimeSet({ timeField: 'endTime', timeInMinutes: endMinutes });
  }

  onTimeInputChange(fieldId, valueInMinutes) {
    // valueInMinutes arrives as a number when it comes from a typed/picked
    // time or the "continue to end of day" checkbox, but as a string when
    // it comes via the start-time/end-time HTML attribute (e.g. reopening
    // a saved entry - HTML attributes are always strings). Coercing here,
    // at the one place both paths converge, keeps every downstream
    // consumer (recalculateDuration's < comparison and += in particular)
    // working with numbers, not a string/number mix.
    const minutes = Number(valueInMinutes);
    switch (fieldId) {
      case 'startTime':
        /* we can't have a start time less than the day boundary */
        this.startInputMinutes = minutes;
        this.props.onTimeSet({ timeField: 'startTime', timeInMinutes: this.startInputMinutes });
        if (isSet(this.endInputMinutes)) {
          this.recalculateDuration(this.startInputMinutes, this.endInputMinutes);
        }
        break;
      case 'endTime':
        this.endInputMinutes = minutes;
        this.props.onTimeSet({ timeField: 'endTime', timeInMinutes: this.endInputMinutes });
        if (isSet(this.startInputMinutes)) {
          this.recalculateDuration(this.startInputMinutes, this.endInputMinutes);
        }
        break;
      case 'duration':
        this.durationInputMinutes = minutes;
        if (isSet(this.startInputMinutes)) {
          this.recalculateEndTime(this.startInputMinutes, this.durationInputMinutes);
        }
        break;
    }
    this.update();
  }

  update() {
    this.restOfDayElement.checked = this.endofday;
    if (isSet(this.startInputMinutes)) {
      this.restOfDayLabelElement.textContent = this.props.getContinueToTarget(
        this.startInputMinutes
      ).label;
    }
    setOrRemoveAttribute(this.startInputElement, 'value', this.formatIfSet(this.startInputMinutes));
    setOrRemoveAttribute(this.endInputElement, 'value', this.formatIfSet(this.endInputMinutes));
    setOrRemoveAttribute(this.endInputElement, 'error', this.endTimeError);
    setOrRemoveAttribute(
      this.durationInputElement,
      'value',
      isSet(this.durationInputMinutes) ? this.durationInputMinutes : undefined
    );
  }

  render() {
    this.innerHTML = `
    <fieldset class="time-container">
      <legend class="sr-only">Schedule Settings</legend>
      
      <el-time-picker ${this.setProps({ change: (timeInHHMMFormat) => this.onTimeInputChange('startTime', this.convertTimePickerFormatToMinutes(timeInHHMMFormat)), getMaxTime: () => this.getMaxEditableTime() })}
        input-id="startTime"
        label="Start time (24-hour format)"
        ${valueAttribute(this.formatIfSet(this.startInputMinutes))}
        constrained="true"
      ></el-time-picker>
      <el-time-picker ${this.setProps({ change: (timeInHHMMFormat) => this.onTimeInputChange('endTime', this.convertTimePickerFormatToMinutes(timeInHHMMFormat)), getMaxTime: () => this.getMaxEditableTime() })}
        input-id="endTime"
        label="End time (24-hour format)"
        ${valueAttribute(this.formatIfSet(this.endInputMinutes))}
        constrained="true"
        ${this.endTimeError ? `error="${this.endTimeError}"` : ''}
      ></el-time-picker>
      <div class="rest-of-day-checkbox-layout">
        <input type="checkbox" id="timepicker-rest-of-day">
        <label for="timepicker-rest-of-day">Continue this activity to the end of the day</label>
      </div>

      <el-duration-input ${this.setProps({ change: (valueInMinutes) => this.onTimeInputChange('duration', valueInMinutes) })}
        data-id="duration"
        input-id="duration"
        label="Duration"
        ${valueAttribute(isSet(this.durationInputMinutes) ? this.durationInputMinutes : undefined)}
      ></el-duration-input>

    </fieldset>
    `;
    this.assignEventHandlers();
  }
}

customElements.define('el-time-picker-panel', TimePickerPanel);
