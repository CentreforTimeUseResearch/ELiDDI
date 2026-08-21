import { TinyBase } from '../base';
import { HIDE_PANEL, SWITCH_DATE } from '../../store/actionTypes';
import { getCurrentDiaryDateKey } from '../../utils/time';
import './datePicker.css';

export class DatePicker extends TinyBase {
  store = super.getStore();
  currentDate;
  dateInput;

  constructor() {
    super();
    this.currentDate = this.store.getState().currentDate;
    this.registerCleanup(this.store.subscribe(() => this.update()));
  }

  connectedCallback() {
    super.connectedCallback();
  }

  assignEventHandlers() {
    this.dateInput = this.querySelector('[data-date-picker]');
    this.dateInput?.addEventListener('change', (e) => {
      e.stopPropagation();
      this.switchDate(e.target.value);
    });
  }

  update() {
    const { currentDate } = this.store.getState();
    if (this.currentDate !== currentDate) {
      this.currentDate = currentDate;
      this.render();
    }
  }

  switchDate(dateKey) {
    if (typeof dateKey !== 'string' || !dateKey) {
      console.error('Problem with date picker value');
      return;
    }

    if (dateKey > getCurrentDiaryDateKey()) {
      // the max attribute keeps the native picker UI from offering future
      // dates, but a typed/scripted value can still get through - reject
      // it and reset the input back to the last valid date
      console.error('Cannot select a future date');
      this.render();
      return;
    }

    this.store.dispatch({
      type: HIDE_PANEL,
    });

    this.store.dispatch({
      type: SWITCH_DATE,
      payload: dateKey,
    });
  }

  render() {
    this.innerHTML = `
            <div class="el-form-group width-adjust">
                <label class="el-label" for="date-picker">Choose date:</label>
                <input
                  type="date"
                  id="date-picker"
                  class="el-input"
                  data-date-picker
                  name="date-picker"
                  value="${this.currentDate}"
                  max="${getCurrentDiaryDateKey()}"
                />
            </div>
        `;
    this.assignEventHandlers();
  }
}

customElements.define('el-date-picker', DatePicker);
