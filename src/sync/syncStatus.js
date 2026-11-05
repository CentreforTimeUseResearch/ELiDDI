// What the Respondent should be told about their diary and the server
// (docs/adr/0007-server-sync-model.md, "Failure and offline"). One small
// observable, set by the sync manager and read by the components, so a
// component never needs the manager itself (and tests can set it directly).

export const SYNC_STATUS = {
  // not logged in, or accounts are off: nothing to say
  IDLE: 'idle',
  // fetching the Respondent's diary from the server; it is not shown yet
  LOADING: 'loading',
  // the diary could not be fetched and there is no copy on this device to show
  LOAD_FAILED: 'load-failed',
  // everything on this device is on the server
  SAVED: 'saved',
  // a change is on its way to the server
  SAVING: 'saving',
  // a change could not be sent; it is kept here and will be tried again
  UNSAVED: 'unsaved',
  // the server refuses this diary (too large, invalid); retrying will not help
  REJECTED: 'rejected',
  // the server holds a newer format than this copy of the page understands
  OUTDATED: 'outdated',
};

// The statuses in which the diary must not be shown: either it is not here
// yet, or this page must not touch it.
export const BLOCKS_DIARY = new Set([
  SYNC_STATUS.LOADING,
  SYNC_STATUS.LOAD_FAILED,
  SYNC_STATUS.OUTDATED,
]);

// Things the Respondent must be told that are not a status of their own:
//   { kind: 'replaced', dates: ['2026-11-03', ...] }
//       another device had newer versions of these days, so they now show those
//       (the versions that were on this device are kept as a backup)
//   { kind: 'unsent' }
//       they chose to log out but the changes not yet on the server could not be
//       sent; they choose between trying again, logging out anyway, or staying
export const NOTICE_KIND = { REPLACED: 'replaced', UNSENT: 'unsent' };

export function createSyncStatus() {
  let current = SYNC_STATUS.IDLE;
  let notice = null;
  let retryHandler = null;
  const subscribers = new Set();

  return {
    get: () => current,
    set(next) {
      if (next === current) {
        return;
      }
      current = next;
      [...subscribers].forEach((fn) => fn(current));
    },
    getNotice: () => notice,
    setNotice(next) {
      notice = next;
      [...subscribers].forEach((fn) => fn(current));
    },
    dismissNotice() {
      if (notice !== null) {
        this.setNotice(null);
      }
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    // "Try again" on a diary that could not be loaded; the manager registers
    // what that does
    setRetryHandler(fn) {
      retryHandler = fn;
    },
    retry() {
      retryHandler?.();
    },
  };
}

export const appSyncStatus = createSyncStatus();
