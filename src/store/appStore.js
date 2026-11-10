import { eliddiReducer } from './eliddiReducer';
import { createStore } from './store';
import { getBrowserStorage, loadPersistedState, persistStore } from './persistence';
import { accounts } from '../config/appConfig';

// The single app-wide store instance (a singleton via module pattern).
//
// Without server accounts it is seeded from and saved back to localStorage
// (the single 'state' key). What is saved, and how a saved diary is validated
// and migrated on load, lives in persistence.js. Without usable storage the
// diary still works, it just doesn't survive a reload.
//
// With server accounts it starts empty and saves nothing here: whose diary it
// holds is only known after login, and src/sync/syncManager.js then fills it
// and saves it under that Respondent's own key. The single 'state' key is
// ignored (and never deleted) because on a shared device it may belong to
// anyone - see docs/adr/0007-server-sync-model.md.
const accountsOn = accounts().enabled;
const storage = accountsOn ? undefined : getBrowserStorage();
export const appStore = createStore(eliddiReducer, storage && loadPersistedState(storage));

if (storage) {
  persistStore(appStore, storage);
}
