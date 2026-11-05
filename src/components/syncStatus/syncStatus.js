import { TinyBase } from '../base';
import { appSyncStatus, SYNC_STATUS } from '../../sync/syncStatus';
import './syncStatus.css';

// What each status says in the nav bar. Plain words, no jargon: the point is
// that a Respondent can tell whether their work is safe.
const TEXT = {
  [SYNC_STATUS.SAVED]: 'Saved',
  [SYNC_STATUS.SAVING]: 'Saving…',
  [SYNC_STATUS.UNSAVED]: 'Not saved yet - will retry',
  [SYNC_STATUS.REJECTED]: 'Could not save to the server - your diary is kept on this device',
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
    this.querySelector('[data-sync-text]').textContent = TEXT[status] ?? '';
    this.dataset.status = status;
  }

  render() {
    this.innerHTML = '<span data-sync-text role="status" aria-live="polite"></span>';
  }
}

customElements.define('el-sync-status', SyncStatus);
