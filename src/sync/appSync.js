// Starts syncing the app's diary with the server when the study has server
// accounts on (general.server_accounts); otherwise it does nothing at all.
// Imported once, by main.js.

import { appStore } from '../store/appStore';
import { getBrowserStorage } from '../store/persistence';
import { getAccounts } from '../auth/authClient';
import { appSession } from '../auth/session';
import { createSync } from './syncManager';
import { appSyncStatus } from './syncStatus';

const accounts = getAccounts(globalThis.GLOBALS?.DATA);

export const appSync = accounts.enabled
  ? createSync({
      store: appStore,
      session: appSession,
      storage: getBrowserStorage(),
      backendUrl: accounts.backendUrl,
      status: appSyncStatus,
      fetchFn: (...args) => fetch(...args),
    })
  : null;

if (appSync) {
  appSync.start();
  // leaving the page, or coming back to it: send what is unsent now
  document.addEventListener('visibilitychange', () => {
    appSession.check();
    appSync.flush();
  });
  window.addEventListener('online', () => appSync.flush());
}
