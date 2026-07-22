export const createStore = (reducer) => {
  let state;
  let listeners = [];

  const getState = () => state;

  const dispatch = (action) => {
    state = reducer(state, action);
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener); // remove listener
    };
  };

  dispatch({}); // initial state

  // return the store
  return {
    getState,
    dispatch,
    subscribe,
  };
};

export const combineReducers = (reducers) => {
  return (state = {}, action) => {
    return Object.keys(reducers).reduce((nextState, key) => {
      nextState[key] = reducers[key](state[key], action);
      return nextState;
    }, {});
  };
};

function localStoreSave(key, obj) {
  try {
    const serializedData = JSON.stringify(obj);
    localStorage.setItem(key, serializedData);
    return true; // Indicates successful save
  } catch (error) {
    console.error(`Failed to save to localStorage under key "${key}":`, error);

    // Specific check for storage full
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.error('Storage limit exceeded! Please clear up some space.');
    }

    return false; // Indicates failure
  }
}

function localStoreLoad(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error parsing localStorage key "${key}":`, error);
    return null; // Fallback gracefully
  }
}
