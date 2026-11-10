// Starts syncing the app's diary with the server when the study has server
// accounts on (general.server_accounts); otherwise it does nothing at all.
// Imported once, by main.js.

import { appStore } from '../store/appStore';
import { getBrowserStorage } from '../store/persistence';
import { signOut } from '../auth/authClient';
import { accounts as serverAccounts, studyConfig } from '../config/appConfig';
import { appSession } from '../auth/session';
import { createSync } from './syncManager';
import { appSyncStatus, NOTICE_KIND } from './syncStatus';

const accounts = serverAccounts();

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

// Logging out from the page. With server accounts on, first gets what the
// server lacks onto it; if that is not possible, says so and lets the
// Respondent choose (the "unsent" notice: try again, log out anyway, or stay).
// Nothing a Respondent entered is discarded unasked.
export async function requestLogout() {
  if (appSync && !(await appSync.settle())) {
    appSyncStatus.setNotice({ kind: NOTICE_KIND.UNSENT });
    return;
  }
  await signOut({ session: appSession, config: studyConfig() });
}

// the Respondent chose to leave although changes could not be sent: they stay
// on this device, hidden, and go to the server at their next login
export async function logoutAnyway() {
  appSyncStatus.dismissNotice();
  await signOut({ session: appSession, config: studyConfig() });
}
