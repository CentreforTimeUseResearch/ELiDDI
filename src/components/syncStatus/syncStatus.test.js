import { describe, it, expect, beforeEach } from 'vitest';
import { appSyncStatus, SYNC_STATUS } from '../../sync/syncStatus';
import './syncStatus';

describe('SyncStatus', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    appSyncStatus.set(SYNC_STATUS.IDLE);
  });

  const mount = () => {
    const el = document.createElement('el-sync-status');
    document.body.appendChild(el);
    return { el, text: () => el.querySelector('[data-sync-text]').textContent };
  };

  it('is a polite live region, so a change is heard without interrupting', () => {
    const { el } = mount();

    const region = el.querySelector('[data-sync-text]');
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
  });

  it.each([
    [SYNC_STATUS.SAVED, 'Saved'],
    [SYNC_STATUS.SAVING, 'Saving…'],
    [SYNC_STATUS.UNSAVED, 'Not saved yet - will retry'],
    [SYNC_STATUS.REJECTED, 'Could not save to the server - your diary is kept on this device'],
  ])('says what %s means, in words', (status, words) => {
    const { text } = mount();

    appSyncStatus.set(status);

    expect(text()).toBe(words);
  });

  it.each([SYNC_STATUS.IDLE, SYNC_STATUS.LOADING, SYNC_STATUS.LOAD_FAILED, SYNC_STATUS.OUTDATED])(
    'says nothing for %s, which the login dialog covers',
    (status) => {
      const { text } = mount();
      appSyncStatus.set(SYNC_STATUS.SAVED);

      appSyncStatus.set(status);

      expect(text()).toBe('');
    }
  );

  it('shows the current status when it is added to the page', () => {
    appSyncStatus.set(SYNC_STATUS.UNSAVED);

    const { text } = mount();

    expect(text()).toBe('Not saved yet - will retry');
  });

  it('stops listening once it is removed from the page', () => {
    const { el, text } = mount();
    el.remove();

    appSyncStatus.set(SYNC_STATUS.SAVED);

    expect(text()).toBe('');
  });
});
