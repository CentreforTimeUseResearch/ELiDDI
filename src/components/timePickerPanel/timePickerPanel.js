
import { TimePicker } from '../timePicker/timePicker';
import { TinyBase } from '../base';
import './timePickerPanel.css';

export class TimePickerPanel extends TinyBase {

  store = super.getStore();
  startInputValue = '12:00';
  endInputValue;
  durationInputValue;

  endInputElement;
  durationInputElement;
  canSave;

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
  }

  recalculateDuration(startInput, endInput) {
    // Split HH:mm string and convert to total minutes
    const [startHours, startMinutes] = startInput.split(':').map(Number);
    const [endHours, endMinutes] = endInput.split(':').map(Number);

    let startTotalMinutes = (startHours * 60) + startMinutes;
    let endTotalMinutes = (endHours * 60) + endMinutes;

    // Handle though midnight events (e.g., 22:00 to 02:00 next day)
    if (endTotalMinutes < startTotalMinutes) {
      endTotalMinutes += 24 * 60; // Add 24 hours in minutes
    }

    // Calculate total difference in minutes
    const diffMinutes = endTotalMinutes - startTotalMinutes;

    // Format minutes back into Hours and Minutes
    const durationHours = String(Math.floor(diffMinutes / 60)).padStart(2, "0");
    const durationMinutes = String((diffMinutes % 60)).padStart(2, "0");

    this.durationInputValue = `${durationHours}:${durationMinutes}`;

    // this.durationInputElement.setAttribute('value', this.durationInputValue);
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
    switch (fieldId) {
      case 'startTime':
        this.startInputValue = value;
        if (this.endInputValue) {
          this.recalculateDuration(this.startInputValue, this.endInputValue);
        }
        break;
      case 'endTime':
        this.endInputValue = value;
        if (this.startInputValue) {
          this.recalculateDuration(this.startInputValue, this.endInputValue);
        }
        break;
      case 'duration':
        this.durationInputValue = value;
        if (this.startInputValue) {
          this.recalculateEndTime(this.startInputValue, this.durationInputValue);
        }
        break;
    }
    if (this.startInputValue && this.endInputValue) {
      this.canSave = true;
      this.render()
    }
  }

  render() {
    this.innerHTML = `
    <fieldset class="time-container">
      <legend class="sr-only">Schedule Settings</legend>
      
      <el-time-picker ${this.setProps({ change: (timeProps) => this.onTimeInputChange("startTime", timeProps) })} input-id="startTime" label="Start time (24-hour format)" value="${this.startInputValue}" constrained="true"></el-time-picker>
      <el-time-picker ${this.setProps({ change: (timeProps) => this.onTimeInputChange("endTime", timeProps) })} input-id="endTime" label="End time (24-hour format)" value="${this.endInputValue}" constrained="true"></el-time-picker>
      <el-time-picker input-id="duration" label="Duration" value="${this.durationInputValue}" read-only="true"></el-time-picker>
    </fieldset>
    `;
  }
}

customElements.define('el-time-picker-panel', TimePickerPanel);
