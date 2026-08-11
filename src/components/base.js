import { eliddiReducer } from '../store/eliddiReducer';
import { createStore } from '../store/store';
import { localStoreSave, localStoreLoad } from '../store/localStorage';

// singletons via module patten


// props is a key:value store that allows components to pass objects arrays and functions  
const props = {};

// application state (based on primitive redux)
const persistedState = localStoreLoad();
let store = createStore(eliddiReducer, persistedState);
store.subscribe(() => {
  localStoreSave({ ...store.getState(), uipanel: undefined, currentTimelineIndex: undefined })
})

export class TinyBase extends HTMLElement {
  key;

  constructor() {
    super();
  }

  connectedCallback() {
    this.key = this.getAttribute('key');
    this.props = this.getProps(this.key);
    this.render();
  }

  getProps(key) {
    return props[key];
  }

  getStore() {
    return store;
  }

  createUUID() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 12).padStart(12, 0);
  }

  setProps(newProps, returnKey = false) {
    // check props type
    if (!(newProps === Object(newProps) && Object.prototype.toString.call(newProps) !== '[object Array]')) {
      console.log('newProps must be a js object of {key:value} structure')
      return
    }
    // automatically bind the functions
    Object.keys(newProps).forEach((prop) => {
      if (typeof newProps[prop] === 'function') {
        newProps[prop] = newProps[prop].bind(this);
      }
    });

    const uuid = this.createUUID();
    props[uuid] = newProps;

    if (returnKey) {
      return uuid;
    }

    return `key = ${uuid}`;
  }

  disconnectedCallback() {
    delete props[this.key];
  }

  render() {
    // overriden by child components
  }
}
