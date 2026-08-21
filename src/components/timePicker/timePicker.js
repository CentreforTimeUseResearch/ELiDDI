import { TinyBase } from '../base';
import {
  INPUT_ID_ATTR,
  LABEL_ATTR,
  VALUE_ATTR,
  handleValidatedFieldAttributeChange,
  showFieldError,
  clearFieldError,
} from '../../utils/validatedFormField';
import './timePicker.css';

const ID = INPUT_ID_ATTR;
const LABEL = LABEL_ATTR;
const VALUE = VALUE_ATTR;
const CONSTRAINED = 'constrained';
const READ_ONLY = 'read-only';
const REQUIRED = 'required';

export class TimePicker extends TinyBase {
  static observedAttributes = [ID, LABEL, VALUE, CONSTRAINED, READ_ONLY, REQUIRED];

  store = super.getStore();
  timeInput;
  value;
  // resolved once props are available, in connectedCallback - undefined
  // means no future-time constraint currently applies (e.g. editing a
  // past diary day)
  maxTimeValue;
  time24Regex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    // this.store.subscribe(()=>this.onStateUpdate()));
    this.maxTimeValue = this.props?.getMaxTime?.();
    this.assignEventHandlers();
    if (this[CONSTRAINED]) {
      const intervalId = setInterval(this.updateTimeConstraints.bind(this), 30000);
      this.registerCleanup(() => clearInterval(intervalId));
    }
    this.validate();
  }

  updateTimeConstraints() {
    if (!this[CONSTRAINED]) {
      return;
    }

    const newTime = this.props?.getMaxTime?.();

    // Only update the DOM if the minute (or constrained-ness) has actually changed
    if (newTime !== this.maxTimeValue) {
      this.maxTimeValue = newTime;
      if (this.maxTimeValue === undefined) {
        this.timeInput.removeAttribute('max');
      } else {
        this.timeInput.setAttribute('max', this.maxTimeValue);
      }
      this.validate();
    }
  }

  assignEventHandlers() {
    this.timeInput = this.querySelector(`[data-id=${this[ID]}]`);
    this.errorDisplay = this.querySelector(`[data-id=${this[ID]}-time-error]`);
    // Feature detection: Check if browser downgrades "time" to "text"
    const isTimeSupported = this.timeInput.type === 'time';
    if (!isTimeSupported) {
      // Explicitly update attributes for screen readers on legacy browsers
      this.timeInput.setAttribute('placeholder', 'HH:MM');
      this.timeInput.setAttribute('maxLength', '5');

      // Prevent non-numeric or non-colon character typing entirely
      this.timeInput.addEventListener('keypress', (e) => {
        if (!/[\d:]/.test(e.key)) {
          e.preventDefault();
        }
      });
    } else {
      if (this[CONSTRAINED] && this.maxTimeValue !== undefined) {
        this.timeInput.setAttribute('max', this.maxTimeValue);
      }
    }
    this.timeInput.addEventListener('click', (e) => {
      if (e) {
        e.stopPropagation();
      }
    }); // dont allow click to trigger timeline click
    this.timeInput.addEventListener('blur', () => this.validate());
    this.timeInput.addEventListener('change', (e) => {
      this.value = e.target.value;
      this.props.change(this.value);
    });
  }

  validate() {
    const value = this.timeInput.value.trim();

    // validate
    if (value === '' && this.timeInput.hasAttribute('required')) {
      this.showError(`The ${this[LABEL]} time field is required.`);
    } else if (value !== '' && !this.time24Regex.test(value)) {
      this.showError('Please enter a valid 24-hour time between 00:00 and 23:59.');
    } else if (this[CONSTRAINED] && this.maxTimeValue !== undefined && value > this.maxTimeValue) {
      this.showError(
        `Time cannot be in the future. Please select a time at or before ${this.maxTimeValue}.`
      );
    } else {
      this.clearError();
      this.value = value;
    }
  }

  showError(message) {
    showFieldError(this.errorDisplay, this.timeInput, message);
  }

  clearError() {
    clearFieldError(this.errorDisplay, this.timeInput);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    handleValidatedFieldAttributeChange(this, name, newValue);
  }

  render() {
    this.innerHTML = `<div id="${this[ID]}-time-error"></div>
      <label for="${this[ID]}" class="time-label">${this[LABEL]}</label><br />

      <input 
        type="time" 
        ${this[VALUE] ? `value="${this[VALUE]}"` : ''}
        data-id="${this[ID]}" 
        name="${this[ID]}"
        max="23:59"
        ${this[REQUIRED] ? 'required' : ''}
        ${this[READ_ONLY] ? 'readonly' : ''}
        aria-describedby="${this[ID]}-time-hint time-error">
        
      <!-- Accessible descriptions: Status hints and errors -->
      <span data-id="${this[ID]}-time-hint" class="hint-text" hidden>Format: HH:MM (e.g., 14:30)</span>
      <span data-id="${this[ID]}-time-error" class="error-text" aria-live="polite" hidden></span>
    `;
  }
}

customElements.define('el-time-picker', TimePicker);
