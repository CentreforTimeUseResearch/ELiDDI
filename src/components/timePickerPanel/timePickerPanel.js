
import { TimePicker } from '../timePicker/timePicker';
import { TinyBase } from '../base';
import './timePickerPanel.css';

const DAY_BOUNDARY = 'day-boundary';
const START_TIME = 'start-time'
export class TimePickerPanel extends TinyBase {
  static observedAttributes = [DAY_BOUNDARY, START_TIME];

  store = super.getStore();
  startInputValue;
  endInputValue;
  durationInputValue;

  startInputElement;
  endInputElement;
  restOfDayElement;
  durationInputElement;
  endofday = false;
  dayBoundaryInMinutes;


  startTimeError = "";
  endTimeError = "";

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    // this.store.subscribe(()=>this.onStateUpdate()));
    this.assignEventHandlers();
  }

  assignEventHandlers() {
    this.endInputElement = this.querySelector('[input-id="endTime"]');
    this.durationInputElement = this.querySelector('[input-id="duration"]')
    this.restOfDayElement = this.querySelector('#timepicker-rest-of-day')

    this.restOfDayElement.addEventListener('change', (e) => this.handleRestOfDayCheckboxClick(e))

  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this[name] !== newValue) {
      this[name] = newValue;
    }
    if (name === START_TIME) {
      this.onTimeInputChange('startTime', {
        value: this.convertMinutesToTimePickerFormat(newValue)
      })
    }
    if (name === DAY_BOUNDARY) {
      this.dayBoundaryInMinutes = (Number(this[DAY_BOUNDARY]) - 1) + (24 * 60)
    }
  }

  convertMinutesToTimePickerFormat(minutes) {
    let timeInMinutes = minutes;
    if (timeInMinutes > (24 * 60)) {
      timeInMinutes = minutes - (24 * 60)
    }

    const hours = String(Math.floor(timeInMinutes / 60)).padStart(2, "0");
    const mins = String((timeInMinutes % 60)).padStart(2, "0");

    return `${hours}:${mins}`;
  }

  // Split HH:mm string and convert to total minutes
  convertTimePickerFormatToMinutes(hhmmstringformat) {
    const [hours, minutes] = hhmmstringformat.split(':').map(Number);
    return (hours * 60) + minutes;
  }

  handleRestOfDayCheckboxClick(e) {
    if (event.target.checked) {
      this.endofday = true
      this.onTimeInputChange('endTime', {
        value: this.convertMinutesToTimePickerFormat(this.dayBoundaryInMinutes)
      })
    } else {
      this.endofday = false;
      this.render();
      this.endInputElement.querySelector('input').focus();
    }

  }

  recalculateDuration(startInput, endInput) {
    let startTotalMinutes = this.convertTimePickerFormatToMinutes(startInput);
    let endTotalMinutes = this.convertTimePickerFormatToMinutes(endInput);

    // Handle though midnight events (e.g., 22:00 to 02:00 next day)
    if (endTotalMinutes < startTotalMinutes) {
      endTotalMinutes += 24 * 60; // Add 24 hours in minutes
    }

    const endDayBoundaryInMinutes = (Number(this[DAY_BOUNDARY]) - 1) + (24 * 60);

    /* don't let the end time be beyond the end day boundary */
    if (endTotalMinutes > endDayBoundaryInMinutes) {
      this.endTimeError = `End time can't be between ${GLOBALS.DATA.day_boundary} and ${this.convertMinutesToTimePickerFormat(this.startInputValue)}`
    }

    // Calculate total difference in minutes
    const diffMinutes = endTotalMinutes - startTotalMinutes;

    // Format minutes back into Hours and Minutes
    this.durationInputValue = this.convertMinutesToTimePickerFormat(diffMinutes);

    this.durationInputElement.setAttribute('value', this.durationInputValue);
  }

  recalculateEndTime(startInput, duration) {
    const [startHours, startMinutes] = startInput.split(':').map(Number);
    const [durationHours, durationMinutes] = duration.split(':').map(Number);

    let startTotalMinutes = (startHours * 60) + startMinutes;
    let durationTotalMinutes = (durationHours * 60) + durationMinutes;

    const totalMinutes = startTotalMinutes + durationTotalMinutes;

    // Format minutes back into Hours and Minutes
    const endHours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const endMinutes = String((totalMinutes % 60)).padStart(2, "0");

    this.endInputValue = `${endHours}:${endMinutes}`;
    this.endInputElement.setAttribute('value', this.endInputValue)

  }

  onTimeInputChange(fieldId, timeProps) {
    const { value } = timeProps;
    const valueInMinutes = this.convertTimePickerFormatToMinutes(value)

    switch (fieldId) {
      case 'startTime':
        /* we can't have a start time less than the day boundary */

        this.startInputValue = valueInMinutes;
        if (this.endInputValue) {
          this.recalculateDuration(this.startInputValue, this.endInputValue);
        }
        break;
      case 'endTime':
        this.endInputValue = valueInMinutes;
        if (this.startInputValue) {
          this.recalculateDuration(this.startInputValue, this.endInputValue);
        }
        break;
      case 'duration':
        this.durationInputValue = valueInMinutes;
        if (this.startInputValue) {
          this.recalculateEndTime(this.startInputValue, this.durationInputValue);
        }
        break;
    }
    this.render()
  }

  render() {
    this.innerHTML = `
    <fieldset class="time-container">
      <legend class="sr-only">Schedule Settings</legend>
      
      <el-time-picker ${this.setProps({ change: (timeProps) => this.onTimeInputChange("startTime", timeProps) })} 
        input-id="startTime" 
        label="Start time (24-hour format)" 
        value="${this.convertMinutesToTimePickerFormat(this.startInputValue)}" 
        constrained="true"
        error=${this.startTimeError}
      ></el-time-picker>
      <el-time-picker ${this.setProps({ change: (timeProps) => this.onTimeInputChange("endTime", timeProps) })} 
        input-id="endTime" 
        label="End time (24-hour format)" 
        value="${this.convertMinutesToTimePickerFormat(this.endInputValue)}" 
        constrained="true"
        error="${this.endTimeError}"
      ></el-time-picker>
      <input type="checkbox" id="timepicker-rest-of-day" ${this.endofday ? 'checked' : ''}>
      
      <label for="timepicker-rest-of-day">Continue this activity to the end of the day</label>
      <el-time-picker input-id="duration" label="Duration" value="${this.convertMinutesToTimePickerFormat(this.durationInputValue)}" read-only="true"></el-time-picker>
    </fieldset>
    `;
    this.assignEventHandlers();
  }
}

customElements.define('el-time-picker-panel', TimePickerPanel);
