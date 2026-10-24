import { eliddiReducer } from './eliddiReducer';
import { createStore } from './store';
import { getBrowserStorage, loadPersistedState, persistStore } from './persistence';

// The single app-wide store instance (a singleton via module pattern),
// seeded from and saved back to localStorage. What is saved, and how a
// saved diary is validated and migrated on load, lives in persistence.js.
// Without usable storage the diary still works, it just doesn't survive a
// reload.
const storage = getBrowserStorage();
export const appStore = createStore(eliddiReducer, storage && loadPersistedState(storage));

if (storage) {
  persistStore(appStore, storage);
}
