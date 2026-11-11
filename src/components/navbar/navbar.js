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
import { dayBefore, stepDay } from '../../utils/navigation';
import { getDayStatus } from '../../utils/dayStatus';
import { appSyncStatus, SYNC_STATUS } from '../../sync/syncStatus';
import { accounts, dimensions } from '../../config/appConfig';
import { requestLogout } from '../../sync/appSync';
import { t } from '../../i18n/i18n';
import './navbar.css';

// the generic menu options - rendered twice (menu drawer below 1200px, nav bar
// at/above it, see renderMenuItems) rather than switched via
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

// why Next day can't be used right now - shown as text (the title,
// and a description the screen reader reads), not just by dimming the button
const NEXT_DAY_REASON = 'navbar.nextDayReason';

export { getDayStatus };

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
    // a save that failed must not hide inside the closed drawer on a small
    // screen (the sync indicator lives there below 630px): badge the burger
    if (accounts().enabled) {
      this.registerCleanup(appSyncStatus.subscribe(() => this.updateSyncAlert()));
      this.updateSyncAlert();
    }
  }

  updateSyncAlert() {
    const failed = appSyncStatus.get() === SYNC_STATUS.REJECTED;
    this.querySelector('.ham-menu')?.toggleAttribute('data-sync-alert', failed);
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
    // left to right: burger, day controls, Dimension dropdown, menu links
    // (from 1200px), then the sync and submission status. See navbar.css
    this.innerHTML = `

        <div class="off-screen-menu">
          <div class="menu-container">
            ${accounts().enabled ? '<el-sync-status class="drawer-sync-status"></el-sync-status>' : ''}
            <ul class="menu-list" data-menu="generic">
                ${this.renderMenuItems('menu-item')}
            </ul>
          </div>
        </div>

        <nav>
            <button class="reset-to-div ham-menu" type="button" aria-label="${t('navbar.menuLabel')}">
                <span></span>
                <span></span>
                <span></span>
            </button>
            <div class="day-controls" role="group" aria-label="${t('navbar.changeDay')}">
                <button class="day-button previous-day-button" type="button"><span aria-hidden="true">&lsaquo;</span></button>
                <button class="reset-to-div date-indicator change-date-button" type="button">
                    <span class="date-text"></span>
                    <span class="day-status"></span>
                </button>
                <button class="day-button next-day-button" type="button" aria-describedby="next-day-reason-${this.instanceId}"><span aria-hidden="true">&rsaquo;</span></button>
                <span id="next-day-reason-${this.instanceId}" class="next-day-reason sr-only"></span>
            </div>
            <el-timeline-picker></el-timeline-picker>
            <ul class="nav-menu-list">
                ${this.renderMenuItems('nav-menu-item')}
            </ul>
            <div class="right-pane">
                ${accounts().enabled ? '<el-sync-status class="bar-sync-status"></el-sync-status>' : ''}
                <el-submission-status></el-submission-status>
            </div>
        </nav>
        `;
  }
}

customElements.define('el-nav-bar', Navbar);
