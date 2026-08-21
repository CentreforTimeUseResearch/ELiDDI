import { TimePicker } from '../timePicker/timePicker';
import { DurationInput } from '../durationInput/durationInput';
import { TinyBase } from '../base';
import { getMaxEditableTimeInMinutes } from '../../utils/time';
import './timePickerPanel.css';

const DAY_BOUNDARY = 'day-boundary';
const START_TIME = 'start-time';
const END_TIME = 'end-time';
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

  startTimeError = '';
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
    if (name === START_TIME) {
      this.onTimeInputChange('startTime', newValue);
    }
    if (name === END_TIME) {
      this.onTimeInputChange('endTime', newValue);
    }
    if (name === DAY_BOUNDARY) {
      this.dayBoundaryInMinutes = Number(this[DAY_BOUNDARY]) - 1 + 24 * 60;
    }
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

    /* don't let the end time be beyond the end day boundary */
    if (endTotalMinutes > endDayBoundaryInMinutes) {
      this.endTimeError = `End time can't be between ${GLOBALS.DATA.day_boundary} and ${this.convertMinutesToTimePickerFormat(this.startInputMinutes)}`;
    }

    // store total difference in minutes
    this.durationInputMinutes = endTotalMinutes - startTotalMinutes;

    this.durationInputElement.setAttribute(
      'value',
      this.durationInputMinutes ? this.durationInputMinutes : undefined
    );
  }

  recalculateEndTime(startTotalMinutes, durationTotalMinutes) {
    const endMinutes = Number(startTotalMinutes) + Number(durationTotalMinutes);
    // we need to check that end minutes is not later that 3.59am
    this.endInputMinutes = endMinutes;
    this.endInputElement.setAttribute('value', this.convertMinutesToTimePickerFormat(endMinutes));
    this.props.onTimeSet({ timeField: 'endTime', timeInMinutes: endMinutes });
  }

  onTimeInputChange(fieldId, valueInMinutes) {
    switch (fieldId) {
      case 'startTime':
        /* we can't have a start time less than the day boundary */
        this.startInputMinutes = valueInMinutes;
        this.props.onTimeSet({ timeField: 'startTime', timeInMinutes: this.startInputMinutes });
        if (this.endInputMinutes) {
          this.recalculateDuration(this.startInputMinutes, this.endInputMinutes);
        }
        break;
      case 'endTime':
        this.endInputMinutes = valueInMinutes;
        this.props.onTimeSet({ timeField: 'endTime', timeInMinutes: this.endInputMinutes });
        if (this.startInputMinutes) {
          this.recalculateDuration(this.startInputMinutes, this.endInputMinutes);
        }
        break;
      case 'duration':
        this.durationInputMinutes = valueInMinutes;
        if (this.startInputMinutes) {
          this.recalculateEndTime(this.startInputMinutes, this.durationInputMinutes);
        }
        break;
    }
    this.update();
  }

  update() {
    this.restOfDayElement.checked = this.endofday;
    if (this.startInputMinutes) {
      this.restOfDayLabelElement.textContent = this.props.getContinueToTarget(
        this.startInputMinutes
      ).label;
    }
    this.startInputElement.setAttribute(
      'value',
      this.startInputMinutes
        ? this.convertMinutesToTimePickerFormat(this.startInputMinutes)
        : undefined
    );
    this.endInputElement.setAttribute(
      'value',
      this.endInputMinutes ? this.convertMinutesToTimePickerFormat(this.endInputMinutes) : undefined
    );
    this.durationInputElement.setAttribute(
      'value',
      this.durationInputMinutes ? this.durationInputMinutes : undefined
    );
  }

  render() {
    this.innerHTML = `
    <fieldset class="time-container">
      <legend class="sr-only">Schedule Settings</legend>
      
      <el-time-picker ${this.setProps({ change: (timeInHHMMFormat) => this.onTimeInputChange('startTime', this.convertTimePickerFormatToMinutes(timeInHHMMFormat)), getMaxTime: () => this.getMaxEditableTime() })}
        input-id="startTime"
        label="Start time (24-hour format)"
        value="${this.startInputMinutes ? this.convertMinutesToTimePickerFormat(this.startInputMinutes) : undefined}"
        constrained="true"
        error=${this.startTimeError}
      ></el-time-picker>
      <el-time-picker ${this.setProps({ change: (timeInHHMMFormat) => this.onTimeInputChange('endTime', this.convertTimePickerFormatToMinutes(timeInHHMMFormat)), getMaxTime: () => this.getMaxEditableTime() })}
        input-id="endTime"
        label="End time (24-hour format)"
        value="${this.endInputMinutes ? this.convertMinutesToTimePickerFormat(this.endInputMinutes) : undefined}"
        constrained="true"
        error="${this.endTimeError}"
      ></el-time-picker>
      <div class="rest-of-day-checkbox-layout">
        <input type="checkbox" id="timepicker-rest-of-day">
        <label for="timepicker-rest-of-day">Continue this activity to the end of the day</label>
      </div>

      <el-duration-input ${this.setProps({ change: (valueInMinutes) => this.onTimeInputChange('duration', valueInMinutes) })}
        data-id="duration"
        input-id="duration"
        label="Duration"
        value="${this.durationInputMinutes ? this.durationInputMinutes : undefined}"
      ></el-duration-input>

    </fieldset>
    `;
    this.assignEventHandlers();
  }
}

customElements.define('el-time-picker-panel', TimePickerPanel);
