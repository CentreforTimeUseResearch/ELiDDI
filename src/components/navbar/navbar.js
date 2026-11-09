import '../timelinePicker/timelinePicker.js';
import '../contextualHelp/contextualHelp.js';
import '../syncStatus/syncStatus.js';
import { TinyBase } from '../base';
import { RESET_ONBOARDING, SHOW_PANEL, HIDE_PANEL, SWITCH_DATE } from '../../store/actionTypes';
import { DIARY_STATUS } from '../../store/diaryStatus';
import {
  formatDateKeyAsDDMMYYYY,
  formatDateKeyAsLongDate,
  addDaysToDateKey,
  getCurrentDiaryDateKey,
} from '../../utils/time';
import { getAccounts } from '../../auth/authClient';
import { requestLogout } from '../../sync/appSync';
import './navbar.css';

// the sidebar's generic menu options - rendered twice (sidebar drawer below
// 1024px, nav bar at/above it, see renderMenuItems) rather than switched via
// JS, so this is the one place their labels/handlers are defined
const MENU_ITEMS = [
  { label: 'Instructions', buttonClass: 'instructions-button' },
  { label: 'Reset (clears this day)', buttonClass: 'reset-diary-button' },
  { label: 'View stats' },
  { label: 'About this study' },
  // only with server accounts on (see renderMenuItems)
  { label: 'Log out (switch person)', buttonClass: 'logout-button', accountsOnly: true },
];

// why Next day / Today can't be used right now - shown as text (the title,
// and a description the screen reader reads), not just by dimming the button
const NEXT_DAY_REASON = "You can't fill in days that haven't happened";
const TODAY_REASON = 'Already showing today';

// a Diary's progress for the date button: nothing entered yet, some entered,
// or submitted
export function getDayStatus(diary) {
  if (diary?.status === DIARY_STATUS.COMPLETE) {
    return 'Complete';
  }
  const started = diary?.timelines?.some(
    (timeline) => Array.isArray(timeline) && timeline.length > 0
  );
  return started ? 'In progress' : 'Not started';
}

// each Navbar's description elements get their own ids (aria-describedby needs
// ids, and a page - or a test - may hold more than one Navbar)
let instanceCount = 0;

export class Navbar extends TinyBase {
  ready = false;
  instanceId = ++instanceCount;
  store = super.getStore();
  dateIndicator;

  connectedCallback() {
    super.connectedCallback();
    this.assignEventHandlers();
    this.dateIndicator = this.querySelector('.date-indicator');
    this.registerCleanup(this.store.subscribe(() => this.updateDateIndicator()));
    this.updateDateIndicator();
  }

  // the date button (the day, and its status) and the day buttons around it
  updateDateIndicator() {
    if (!this.dateIndicator) {
      return;
    }
    const { currentDate, diaries } = this.store.getState();
    this.querySelector('.date-text').innerHTML =
      `<span class="date-label">Selected day: </span>${formatDateKeyAsDDMMYYYY(currentDate)} <u>change</u>`;
    this.querySelector('.day-status').textContent = getDayStatus(diaries[currentDate]);
    this.updateDayButtons(currentDate, getCurrentDiaryDateKey());
  }

  // the day Previous goes to: one back, but never to a day that has not begun
  // (a stored day in the future, which no control can reach, steps down to today)
  dayBefore(currentDate, today) {
    const before = addDaysToDateKey(currentDate, -1);
    return before > today ? today : before;
  }

  // names each button for where it goes, and says why Next / Today are off
  updateDayButtons(currentDate, today) {
    this.querySelector('.previous-day-button').setAttribute(
      'aria-label',
      `Previous day, ${formatDateKeyAsLongDate(this.dayBefore(currentDate, today))}`
    );
    const nextDisabled = currentDate >= today;
    this.setDayButton('.next-day-button', '.next-day-reason', nextDisabled, NEXT_DAY_REASON);
    this.querySelector('.next-day-button').setAttribute(
      'aria-label',
      nextDisabled
        ? 'Next day'
        : `Next day, ${formatDateKeyAsLongDate(addDaysToDateKey(currentDate, 1))}`
    );
    this.setDayButton('.today-button', '.today-reason', currentDate === today, TODAY_REASON);
    this.querySelector('.today-button').setAttribute(
      'aria-label',
      `Today, ${formatDateKeyAsLongDate(today)}`
    );
  }

  // aria-disabled, not disabled: a disabled button can't be focused, so a
  // keyboard user could never reach its reason
  setDayButton(buttonSelector, reasonSelector, disabled, reason) {
    const button = this.querySelector(buttonSelector);
    if (disabled) {
      button.setAttribute('aria-disabled', 'true');
      button.setAttribute('title', reason);
    } else {
      button.removeAttribute('aria-disabled');
      button.removeAttribute('title');
    }
    this.querySelector(reasonSelector).textContent = disabled ? reason : '';
  }

  // one day per press, from where the store says it is now. Closes the panel
  // first, as the date picker does (unsaved edits go with it, see
  // DetailsPanelCoordinator's date handling)
  goToDate(dateKey) {
    const { currentDate } = this.store.getState();
    if (dateKey === currentDate || dateKey > getCurrentDiaryDateKey()) {
      return; // no change, or a day that has not begun
    }
    this.store.dispatch({ type: HIDE_PANEL });
    this.store.dispatch({ type: SWITCH_DATE, payload: dateKey });
  }

  assignEventHandlers() {
    if (!this.ready) {
      const hamMenu = this.querySelector('.ham-menu');
      const offScreenMenu = this.querySelector('.off-screen-menu');
      hamMenu?.addEventListener('click', () => {
        hamMenu.classList.toggle('active');
        offScreenMenu.classList.toggle('active');
      });
      // the Instructions button is duplicated (sidebar drawer + nav bar, see
      // renderMenuItems) so every copy needs wiring, not just the first
      this.querySelectorAll('.instructions-button').forEach((button) => {
        button.addEventListener('click', () => {
          this.store.dispatch({ type: RESET_ONBOARDING });
          hamMenu.classList.toggle('active');
          offScreenMenu.classList.toggle('active');
        });
      });
      // asks first: DynamicTimelineUI's reset dialog does the clearing
      this.querySelectorAll('.reset-diary-button').forEach((button) => {
        button.addEventListener('click', () => {
          this.store.dispatch({ type: SHOW_PANEL, payload: 'reset' });
          hamMenu.classList.remove('active');
          offScreenMenu.classList.remove('active');
        });
      });
      // ends this login on this device (and tells the server), so the next
      // person to use a shared device gets the login dialog, not the diary
      this.querySelectorAll('.logout-button').forEach((button) => {
        button.addEventListener('click', () => {
          hamMenu.classList.remove('active');
          offScreenMenu.classList.remove('active');
          requestLogout();
        });
      });
      this.querySelector('.previous-day-button')?.addEventListener('click', () => {
        const { currentDate } = this.store.getState();
        this.goToDate(this.dayBefore(currentDate, getCurrentDiaryDateKey()));
      });
      this.querySelector('.next-day-button')?.addEventListener('click', () => {
        const { currentDate } = this.store.getState();
        this.goToDate(addDaysToDateKey(currentDate, 1)); // goToDate refuses a day that has not begun
      });
      this.querySelector('.today-button')?.addEventListener('click', () => {
        this.goToDate(getCurrentDiaryDateKey());
      });
      this.querySelector('.change-date-button')?.addEventListener('click', () => {
        this.store.dispatch({ type: SHOW_PANEL, payload: 'date' });
        // hamMenu.classList.toggle('active');
        // offScreenMenu.classList.toggle('active');
      });
      this.ready = true;
    }
  }

  // shared between the sidebar's generic-menu <ul> and its >=1024px nav-bar
  // duplicate (see navbar.css) - same items/labels/handlers, only the
  // wrapping classes differ so each copy can be styled for where it lives
  renderMenuItems(itemClass) {
    const accountsOn = getAccounts(globalThis.GLOBALS?.DATA).enabled;
    return MENU_ITEMS.filter((item) => accountsOn || !item.accountsOnly)
      .map((item) =>
        item.buttonClass
          ? `<li class="${itemClass}"><button class="reset-to-div ${item.buttonClass}" type="button">${item.label}</button></li>`
          : `<li class="${itemClass}">${item.label}</li>`
      )
      .join('');
  }

  render() {
    // this component is a work in progress so this output is for debug purposes
    this.innerHTML = `

        <div class="off-screen-menu">
          <div class="menu-container">
            <ul class="menu-list" data-menu="generic">
                ${this.renderMenuItems('menu-item')}
            </ul>
          </div>
        </div>

        <nav>
            <div class="left-pane">
                <button class="reset-to-div ham-menu">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
                <ul class="nav-menu-list">
                    ${this.renderMenuItems('nav-menu-item')}
                </ul>
            </div>
            <div class="middle-pane">
                <el-timeline-picker></el-timeline-picker>
                <div class="day-controls" role="group" aria-label="Change day">
                    <button class="day-button previous-day-button" type="button"><span aria-hidden="true">&lsaquo;</span></button>
                    <button class="reset-to-div date-indicator change-date-button" type="button">
                        <span class="date-text"></span>
                        <span class="day-status"></span>
                    </button>
                    <button class="day-button next-day-button" type="button" aria-describedby="next-day-reason-${this.instanceId}"><span aria-hidden="true">&rsaquo;</span></button>
                    <button class="day-button today-button" type="button" aria-describedby="today-reason-${this.instanceId}">Today</button>
                    <span id="next-day-reason-${this.instanceId}" class="next-day-reason sr-only"></span>
                    <span id="today-reason-${this.instanceId}" class="today-reason sr-only"></span>
                </div>
            </div>
            <div class="right-pane">
                ${getAccounts(globalThis.GLOBALS?.DATA).enabled ? '<el-sync-status></el-sync-status>' : ''}
                <el-contextual-help></el-contextual-help>
            </div>
        </nav>
        `;
  }
}

customElements.define('el-nav-bar', Navbar);
