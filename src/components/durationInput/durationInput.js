import { TinyBase } from '../base';
import './durationInput.css';

const ID = 'input-id';
const LABEL = 'label';
const VALUE = 'value';

const MAX_HOURS = 23;
const MAX_MINUTES = 59;
const MINUTES_PER_HOUR = 60;

export class DurationInput extends TinyBase {
  static observedAttributes = [ID, LABEL, VALUE];

  hoursInput;
  minutesInput;
  errorDisplay;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.assignEventHandlers();
  }

  assignEventHandlers() {
    this.hoursInput = this.querySelector(`#${this[ID]}-hours`);
    this.minutesInput = this.querySelector(`#${this[ID]}-minutes`);
    this.errorDisplay = this.querySelector(`#${this[ID]}-error`);

    [this.hoursInput, this.minutesInput].forEach((input) => {
      input.addEventListener('click', (e) => { if (e) { e.stopPropagation() } });  // dont allow click to trigger timeline click
      input.addEventListener('keypress', (e) => this.restrictToDigits(e));
      input.addEventListener('input', (e) => this.sanitizeInput(e));
      input.addEventListener('change', () => this.handleChange());
    });
  }

  // number-only keyboard entry - follows the GOV.UK Design System pattern of
  // type="text" inputmode="numeric" over native type="number", whose spinner
  // buttons and validation UI are inconsistently announced by screen readers
  restrictToDigits(e) {
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !/\d/.test(e.key)) {
      e.preventDefault();
    }
  }

  // strips anything that slipped past keypress filtering (e.g. paste)
  sanitizeInput(e) {
    const input = e.target;
    const sanitized = input.value.replace(/\D/g, '');
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  validate() {
    const hoursRaw = this.hoursInput.value.trim();
    const minutesRaw = this.minutesInput.value.trim();

    if (hoursRaw !== '' && Number(hoursRaw) > MAX_HOURS) {
      this.showError(this.hoursInput, `Enter hours as a number between 0 and ${MAX_HOURS}.`);
      return false;
    }
    if (minutesRaw !== '' && Number(minutesRaw) > MAX_MINUTES) {
      this.showError(this.minutesInput, `Enter minutes as a number between 0 and ${MAX_MINUTES}.`);
      return false;
    }
    this.clearError();
    return true;
  }

  showError(inputElement, message) {
    inputElement.setAttribute('aria-invalid', 'true');
    this.errorDisplay.textContent = message;
    this.errorDisplay.removeAttribute('hidden');
  }

  clearError() {
    this.hoursInput.setAttribute('aria-invalid', 'false');
    this.minutesInput.setAttribute('aria-invalid', 'false');
    this.errorDisplay.textContent = '';
    this.errorDisplay.setAttribute('hidden', 'true');
  }

  handleChange() {
    if (!this.validate()) { return; }
    const hours = this.hoursInput.value === '' ? 0 : Number(this.hoursInput.value);
    const minutes = this.minutesInput.value === '' ? 0 : Number(this.minutesInput.value);
    this.props.change(hours * MINUTES_PER_HOUR + minutes);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this[name] !== newValue) {
      this[name] = (newValue === "undefined") ? undefined : newValue;
      if (name === VALUE) {
        this.render();
        this.assignEventHandlers();
        this.validate();
      }
    }
  }

  render() {
    const totalMinutes = this[VALUE] !== undefined ? Number(this[VALUE]) : undefined;
    const hours = totalMinutes !== undefined ? Math.floor(totalMinutes / MINUTES_PER_HOUR) : '';
    const minutes = totalMinutes !== undefined ? totalMinutes % MINUTES_PER_HOUR : '';
    const id = this[ID];

    this.innerHTML = `<fieldset class="duration-fieldset">
        <legend>${this[LABEL]}</legend>
        <span id="${id}-hint" class="hint-text">For example, 1 hour and 30 minutes</span>
        <div class="duration-fields">
          <div class="duration-field">
            <label for="${id}-hours">Hours</label>
            <input
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="2"
              id="${id}-hours"
              name="${id}-hours"
              value="${hours}"
              aria-describedby="${id}-hint ${id}-error">
          </div>
          <div class="duration-field">
            <label for="${id}-minutes">Minutes</label>
            <input
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="2"
              id="${id}-minutes"
              name="${id}-minutes"
              value="${minutes}"
              aria-describedby="${id}-hint ${id}-error">
          </div>
        </div>
        <span id="${id}-error" class="error-text" aria-live="polite" hidden></span>
      </fieldset>
    `;
  }
}

customElements.define('el-duration-input', DurationInput);
