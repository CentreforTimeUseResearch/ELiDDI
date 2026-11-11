import { TinyBase } from '../base';
import { HIDE_PANEL, SWITCH_DATE } from '../../store/actionTypes';
import { getCurrentDiaryDateKey, formatDateKeyAsDDMMYYYY } from '../../utils/time';
import { getDayStatus } from '../../utils/dayStatus';
import { guardUnsavedEdits } from '../../utils/unsavedEdits';
import { t } from '../../i18n/i18n';
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
    this.querySelectorAll('[data-day]').forEach((button) =>
      button.addEventListener('click', () => this.switchDate(button.dataset.day))
    );
  }

  update() {
    const { currentDate } = this.store.getState();
    // a day's status changes as entries are made, so the list is redrawn as
    // well as when the day changes (unless a native date input is being used)
    const daysShown = this.daysMarkup();
    if (this.currentDate !== currentDate || this.daysShown !== daysShown) {
      this.currentDate = currentDate;
      this.render();
    }
  }

  // the days this diary has (any entered, plus today), newest last, each with
  // its status - a native date input cannot show that
  daysMarkup() {
    const { diaries } = this.store.getState();
    const today = getCurrentDiaryDateKey();
    const days = [...new Set([...Object.keys(diaries ?? {}), today, this.currentDate])]
      .filter((day) => day <= today)
      .sort();
    return days
      .map((day) => {
        const status = getDayStatus(diaries?.[day]);
        const label = t('datePicker.dayStatus', {
          date: formatDateKeyAsDDMMYYYY(day),
          status,
        });
        return `<li><button type="button" class="reset-to-div day-choice" data-day="${day}"${day === this.currentDate ? ' aria-current="date"' : ''}>${label}</button></li>`;
      })
      .join('');
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

    // unsaved edits go with the day, so the Respondent is asked first; if they
    // keep editing the picker goes back to the day still showing
    guardUnsavedEdits(
      { all: true },
      () => {
        this.store.dispatch({
          type: HIDE_PANEL,
        });

        this.store.dispatch({
          type: SWITCH_DATE,
          payload: dateKey,
        });
      },
      () => {
        if (this.dateInput) this.dateInput.value = this.currentDate;
      }
    );
  }

  render() {
    this.daysShown = this.daysMarkup();
    this.innerHTML = `
            <div class="el-form-group width-adjust">
                <label class="el-label" for="date-picker">${t('datePicker.label')}</label>
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
            <ul class="day-choices" aria-label="${t('datePicker.daysLabel')}">${this.daysShown}</ul>
        `;
    this.assignEventHandlers();
  }
}

customElements.define('el-date-picker', DatePicker);
