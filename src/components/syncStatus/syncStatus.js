import { TinyBase } from '../base';
import { appSyncStatus, SYNC_STATUS } from '../../sync/syncStatus';
import { t } from '../../i18n/i18n';
import './syncStatus.css';

// What each status says in the nav bar (catalogue keys, translated at use
// time). Plain words, no jargon: the point is that a Respondent can tell
// whether their work is safe.
const TEXT = {
  [SYNC_STATUS.SAVED]: 'syncStatus.saved',
  [SYNC_STATUS.SAVING]: 'syncStatus.saving',
  [SYNC_STATUS.UNSAVED]: 'syncStatus.unsaved',
  [SYNC_STATUS.REJECTED]: 'syncStatus.rejected',
};

// A small status line for study with server accounts on (see
// src/sync/syncManager.js): Saved, Saving, Not saved yet, or Could not save.
// A polite live region, so a screen reader hears a change without being
// interrupted. Shows nothing at other times (not logged in, or loading).
export class SyncStatus extends TinyBase {
  connectedCallback() {
    super.connectedCallback();
    this.registerCleanup(appSyncStatus.subscribe(() => this.update()));
    this.update();
  }

  update() {
    const status = appSyncStatus.get();
    this.querySelector('[data-sync-text]').textContent = status in TEXT ? t(TEXT[status]) : '';
    this.dataset.status = status;
  }

  render() {
    this.innerHTML = '<span data-sync-text role="status" aria-live="polite"></span>';
  }
}

customElements.define('el-sync-status', SyncStatus);
