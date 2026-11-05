import { TinyBase } from '../base';
import { appSyncStatus, NOTICE_KIND } from '../../sync/syncStatus';
import { logoutAnyway, requestLogout } from '../../sync/appSync';
import './syncNotice.css';

// "3 November 2026" from "2026-11-03"; the key as it is if it is not a date
export function describeDate(key) {
  const date = new Date(`${key}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? key
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

const listOf = (items) =>
  items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

// What the Respondent is told, and what they can do about it, when the server's
// copy of their diary and this device's disagreed (docs/adr/0007, "Two devices").
// Plain sentences; nothing is lost without being said.
export class SyncNotice extends TinyBase {
  connectedCallback() {
    super.connectedCallback();
    this.registerCleanup(appSyncStatus.subscribe(() => this.update()));
    this.update();
  }

  update() {
    const notice = appSyncStatus.getNotice();
    this.hidden = notice === null;
    if (notice === null) {
      this.innerHTML = '';
      return;
    }
    if (notice.kind === NOTICE_KIND.REPLACED) {
      const days = listOf(notice.dates.map(describeDate));
      const plural = notice.dates.length > 1;
      this.innerHTML = `
        <div class="sync-notice" role="status">
          <p>Another device had a newer version of ${days}, so ${plural ? 'those days now show' : 'that day now shows'} the newer ${plural ? 'versions' : 'version'}.
          Your earlier ${plural ? 'versions are' : 'version is'} kept on this device.</p>
          <div class="sync-notice-buttons"><button type="button" data-notice="dismiss">OK</button></div>
        </div>`;
    } else if (notice.kind === NOTICE_KIND.UNSENT) {
      this.innerHTML = `
        <div class="sync-notice sync-notice-alert" role="alert">
          <p>Your latest changes could not be sent to the server. If you log out now they stay on this device,
          and are sent the next time you log in here.</p>
          <div class="sync-notice-buttons">
            <button type="button" data-notice="retry">Try again</button>
            <button type="button" data-notice="logout">Log out anyway</button>
            <button type="button" data-notice="dismiss">Stay logged in</button>
          </div>
        </div>`;
    }
  }

  render() {
    this.hidden = true;
    this.addEventListener('click', (event) => {
      const action = event.target.closest('[data-notice]')?.dataset.notice;
      if (action === 'dismiss') {
        appSyncStatus.dismissNotice();
      } else if (action === 'retry') {
        appSyncStatus.dismissNotice();
        requestLogout();
      } else if (action === 'logout') {
        logoutAnyway();
      }
    });
  }
}

customElements.define('el-sync-notice', SyncNotice);
