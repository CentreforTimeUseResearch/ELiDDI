import { eliddiReducer } from './eliddiReducer';
import { createStore } from './store';
import { localStoreSave, localStoreLoad } from './localStorage';

// The single app-wide store instance (a singleton via module pattern),
// seeded from localStorage and re-persisted on every dispatch, excluding
// transient UI-only slices (uipanel, currentDimensionIndex).
const persistedState = localStoreLoad();
export const appStore = createStore(eliddiReducer, persistedState);

appStore.subscribe(() => {
  localStoreSave({
    ...appStore.getState(),
    uipanel: undefined,
    currentDimensionIndex: undefined,
  });
});
