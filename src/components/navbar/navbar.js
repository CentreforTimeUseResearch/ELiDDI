import '../timelinePicker/timelinePicker.js';
import '../submissionStatus/submissionStatus.js';
import '../syncStatus/syncStatus.js';
import { TinyBase } from '../base';
import { RESET_ONBOARDING, SHOW_PANEL } from '../../store/actionTypes';
import { DIARY_STATUS } from '../../store/diaryStatus';
import {
  formatDateKeyAsDDMMYYYY,
  formatDateKeyAsLongDate,
  addDaysToDateKey,
  getCurrentDiaryDateKey,
} from '../../utils/time';
import { announce, ensureAnnouncer } from '../../utils/announce';
import { dayBefore, stepDay, goToToday } from '../../utils/navigation';
import { accounts, dimensions } from '../../config/appConfig';
import { requestLogout } from '../../sync/appSync';
import { t } from '../../i18n/i18n';
import './navbar.css';

// the sidebar's generic menu options - rendered twice (sidebar drawer below
// 1024px, nav bar at/above it, see renderMenuItems) rather than switched via
// JS, so this is the one place their labels/handlers are defined. Labels are
// catalogue keys, translated when rendered (ADR 0008)
const MENU_ITEMS = [
  { label: 'navbar.menu.instructions', buttonClass: 'instructions-button' },
  { label: 'navbar.menu.shortcuts', buttonClass: 'shortcuts-button' },
  { label: 'navbar.menu.reset', buttonClass: 'reset-diary-button' },
  { label: 'navbar.menu.stats' },
  { label: 'navbar.menu.about' },
  // only with server accounts on (see renderMenuItems)
  { label: 'navbar.menu.logout', buttonClass: 'logout-button', accountsOnly: true },
];

// why Next day / Today can't be used right now - shown as text (the title,
// and a description the screen reader reads), not just by dimming the button
const NEXT_DAY_REASON = 'navbar.nextDayReason';
const TODAY_REASON = 'navbar.todayReason';

// a Diary's progress for the date button: nothing entered yet, some entered,
// or submitted
export function getDayStatus(diary) {
  if (diary?.status === DIARY_STATUS.COMPLETE) {
    return t('navbar.status.complete');
  }
  const started = diary?.timelines?.some(
    (timeline) => Array.isArray(timeline) && timeline.length > 0
  );
  return started ? t('navbar.status.inProgress') : t('navbar.status.notStarted');
}

// each Navbar's description elements get their own ids (aria-describedby needs
// ids, and a page - or a test - may hold more than one Navbar)
let instanceCount = 0;

// what is said when the day changes: which day, and how far on it is
export function getDayAnnouncement(dateKey, diary) {
  const day = formatDateKeyAsLongDate(dateKey);
  if (diary?.status === DIARY_STATUS.COMPLETE) {
    return t('navbar.announce.complete', { day });
  }
  const total = dimensions().length;
  const started = (diary?.timelines ?? []).filter(
    (timeline) => Array.isArray(timeline) && timeline.length > 0
  ).length;
  return t('navbar.announce.progress', { day, started, total });
}

export class Navbar extends TinyBase {
  ready = false;
  instanceId = ++instanceCount;
  store = super.getStore();
  dateIndicator;

  connectedCallback() {
    super.connectedCallback();
    ensureAnnouncer(); // before its first message, so a screen reader is already listening
    this.assignEventHandlers();
    this.dateIndicator = this.querySelector('.date-indicator');
    this.shownDate = this.store.getState().currentDate; // not announced: it is only being shown
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
      `<span class="date-label">${t('navbar.selectedDay')}</span>${formatDateKeyAsDDMMYYYY(currentDate)} <u>${t('navbar.changeDate')}</u>`;
    this.querySelector('.day-status').textContent = getDayStatus(diaries[currentDate]);
    this.updateDayButtons(currentDate, getCurrentDiaryDateKey());
    // however the day changed (a button, the date picker, anything else) it is
    // said, as focus stays where it was: the buttons stay in reach to be
    // pressed again, and the picker's dialog returns focus to the date button
    if (this.shownDate !== currentDate) {
      this.shownDate = currentDate;
      announce(getDayAnnouncement(currentDate, diaries[currentDate]));
    }
  }

  // names each button for where it goes, and says why Next / Today are off
  updateDayButtons(currentDate, today) {
    this.querySelector('.previous-day-button').setAttribute(
      'aria-label',
      t('navbar.previousDayLabel', {
        date: formatDateKeyAsLongDate(dayBefore(currentDate, today)),
      })
    );
    const nextDisabled = currentDate >= today;
    this.setDayButton('.next-day-button', '.next-day-reason', nextDisabled, NEXT_DAY_REASON);
    this.querySelector('.next-day-button').setAttribute(
      'aria-label',
      nextDisabled
        ? t('navbar.nextDayDisabledLabel')
        : t('navbar.nextDayLabel', {
            date: formatDateKeyAsLongDate(addDaysToDateKey(currentDate, 1)),
          })
    );
    this.setDayButton('.today-button', '.today-reason', currentDate === today, TODAY_REASON);
    this.querySelector('.today-button').setAttribute(
      'aria-label',
      t('navbar.todayLabel', { date: formatDateKeyAsLongDate(today) })
    );
  }

  // aria-disabled, not disabled: a disabled button can't be focused, so a
  // keyboard user could never reach its reason
  setDayButton(buttonSelector, reasonSelector, disabled, reasonKey) {
    const reason = t(reasonKey);
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
      // the keyboard shortcuts, in a dialog of DynamicTimelineUI's
      this.querySelectorAll('.shortcuts-button').forEach((button) => {
        button.addEventListener('click', () => {
          this.store.dispatch({ type: SHOW_PANEL, payload: 'shortcuts' });
          hamMenu.classList.remove('active');
          offScreenMenu.classList.remove('active');
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
      // one day per press, from where the store says it is now; the keyboard
      // shortcuts on a Timeline call the same functions (utils/navigation.js)
      this.querySelector('.previous-day-button')?.addEventListener('click', () =>
        stepDay(this.store, -1)
      );
      this.querySelector('.next-day-button')?.addEventListener('click', () =>
        stepDay(this.store, 1)
      );
      this.querySelector('.today-button')?.addEventListener('click', () => goToToday(this.store));
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
    const accountsOn = accounts().enabled;
    return MENU_ITEMS.filter((item) => accountsOn || !item.accountsOnly)
      .map((item) =>
        item.buttonClass
          ? `<li class="${itemClass}"><button class="reset-to-div ${item.buttonClass}" type="button">${t(item.label)}</button></li>`
          : `<li class="${itemClass}">${t(item.label)}</li>`
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
                <div class="day-controls" role="group" aria-label="${t('navbar.changeDay')}">
                    <button class="day-button previous-day-button" type="button"><span aria-hidden="true">&lsaquo;</span></button>
                    <button class="reset-to-div date-indicator change-date-button" type="button">
                        <span class="date-text"></span>
                        <span class="day-status"></span>
                    </button>
                    <button class="day-button next-day-button" type="button" aria-describedby="next-day-reason-${this.instanceId}"><span aria-hidden="true">&rsaquo;</span></button>
                    <button class="day-button today-button" type="button" aria-describedby="today-reason-${this.instanceId}">${t('navbar.today')}</button>
                    <span id="next-day-reason-${this.instanceId}" class="next-day-reason sr-only"></span>
                    <span id="today-reason-${this.instanceId}" class="today-reason sr-only"></span>
                </div>
            </div>
            <div class="right-pane">
                ${accounts().enabled ? '<el-sync-status></el-sync-status>' : ''}
                <el-submission-status></el-submission-status>
            </div>
        </nav>
        `;
  }
}

customElements.define('el-nav-bar', Navbar);
