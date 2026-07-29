export const createStore = (reducer, initialState = undefined) => {
  let state = initialState;
  let listeners = [];

  const getState = () => state;

  const dispatch = (action) => {
    state = reducer(state, action);
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener) => {
    if (typeof listener !== 'function') {
      console.error('cannot subscribe a non function')
      return;
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener); // remove listener
    };
  };

  dispatch({}); // initialise state

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


