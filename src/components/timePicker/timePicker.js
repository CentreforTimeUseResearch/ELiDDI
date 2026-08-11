import { TinyBase } from '../base';
import './timePicker.css';


const ID = 'input-id';
const LABEL = 'label';
const VALUE = 'value';
const CONSTRAINED = 'constrained';
const READ_ONLY = "read-only";
const REQUIRED = "required"

export class TimePicker extends TinyBase {
  static observedAttributes = [ID, LABEL, VALUE, CONSTRAINED, READ_ONLY, REQUIRED];

  store = super.getStore();
  timeInput;
  value;
  maxTimeValue = this.getCurrentTime24();
  time24Regex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  constructor() {
    super();
  }

  getCurrentTime24() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  connectedCallback() {
    super.connectedCallback();
    // this.store.subscribe(()=>this.onStateUpdate()));
    this.assignEventHandlers();
    if (this[CONSTRAINED]) {
      setInterval(this.updateTimeConstraints.bind(this), 30000);
    }
    this.validate();
  }

  updateTimeConstraints() {
    if (!this[CONSTRAINED]) { return }

    const newTime = this.getCurrentTime24();

    // Only update the DOM if the minute has actually changed
    if (newTime !== this.maxTimeValue) {
      this.maxTimeValue = newTime;
      this.timeInput.setAttribute("max", this.maxTimeValue);
    }
  }

  assignEventHandlers() {
    this.timeInput = this.querySelector(`[data-id=${this[ID]}]`);
    this.errorDisplay = this.querySelector(`[data-id=${this[ID]}-time-error]`);
    // Feature detection: Check if browser downgrades "time" to "text"
    const isTimeSupported = this.timeInput.type === "time";
    if (!isTimeSupported) {
      // Explicitly update attributes for screen readers on legacy browsers
      this.timeInput.setAttribute("placeholder", "HH:MM");
      this.timeInput.setAttribute("maxLength", "5");

      // Prevent non-numeric or non-colon character typing entirely
      this.timeInput.addEventListener("keypress", (e) => {
        if (!/[\d:]/.test(e.key)) {
          e.preventDefault();
        }
      });
    } else {
      if (this[CONSTRAINED]) {
        this.timeInput.setAttribute("max", this.maxTimeValue);
      }
    }

    this.timeInput.addEventListener("blur", () => this.validate());
    this.timeInput.addEventListener('change', (e) => {
      this.value = e.target.value;
      this.props.change(this.value)
    });
  }

  validate() {
    const value = this.timeInput.value.trim();

    // validate
    if (value === "" && this.timeInput.hasAttribute("required")) {
      this.showError(`The ${this[LABEL]} time field is required.`);
    } else if (value !== "" && !this.time24Regex.test(value)) {
      this.showError("Please enter a valid 24-hour time between 00:00 and 23:59.");
    } else if (this[CONSTRAINED] && (value > this.maxTimeValue)) {
      this.showError(`Time cannot be in the future. Please select a time at or before ${this.maxTimeValue}.`);
    } else {
      this.clearError();
      this.value = value;
    }
  }

  showError(message) {
    this.timeInput.setAttribute("aria-invalid", "true"); // Tells screen reader it is broken
    this.errorDisplay.textContent = message;
    this.errorDisplay.removeAttribute("hidden");
  }

  clearError() {
    this.timeInput.setAttribute("aria-invalid", "false");
    this.errorDisplay.textContent = "";
    this.errorDisplay.setAttribute("hidden", "true");
  }


  attributeChangedCallback(name, oldValue, newValue) {
    if (this[name] !== newValue) {
      this[name] = (newValue === "undefined") ? undefined : newValue;
      if (name === "value") {
        this.render();
        this.assignEventHandlers();
        this.validate();
      }
    }
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
      <span data-id="${this[ID]}-time-hint" class="hint-text">Format: HH:MM (e.g., 14:30)</span>
      <span data-id="${this[ID]}-time-error" class="error-text" aria-live="polite" hidden></span>
    `
  }
}

customElements.define('el-time-picker', TimePicker);
