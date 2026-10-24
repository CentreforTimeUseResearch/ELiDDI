export const createStore = (reducer, initialState = undefined) => {
  let state = initialState;
  // one record per subscribe() call (not per function), so subscribing the
  // same function twice gives two independent subscriptions, and each
  // unsubscribe removes exactly its own
  const subscriptions = new Set();

  const getState = () => state;

  const dispatch = (action) => {
    state = reducer(state, action);
    // iterate a snapshot, so a listener subscribed mid-dispatch waits for
    // the next one - but re-check membership, so a listener unsubscribed
    // mid-dispatch (e.g. a component torn down by an earlier listener's
    // re-render) is not called against its now-detached DOM
    [...subscriptions].forEach((subscription) => {
      if (!subscriptions.has(subscription)) {
        return;
      }
      // one failing listener must not leave every later one un-notified,
      // and must not throw out of dispatch() into the caller's event handler
      try {
        subscription.listener();
      } catch (error) {
        console.error('A store listener threw:', error);
      }
    });
  };

  const subscribe = (listener) => {
    if (typeof listener !== 'function') {
      // thrown, not logged: callers hand the return value straight to
      // registerCleanup(), so returning undefined only moved the failure
      // to teardown, far from the mistake
      throw new TypeError(`store.subscribe expects a function, got ${typeof listener}`);
    }
    const subscription = { listener };
    subscriptions.add(subscription);
    return () => {
      subscriptions.delete(subscription);
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
