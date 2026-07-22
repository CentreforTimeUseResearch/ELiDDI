import { eliddiReducer } from '../store/eliddiReducer';
import { createStore } from '../store/store';

// singletons via module patten
const props = {};
let store;

export class TinyBase extends HTMLElement {
  key;

  constructor() {
    super();
    store = createStore(eliddiReducer);
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

  setProps(newProps) {
    // automatically bind the functions
    Object.keys(newProps).forEach((prop) => {
      if (typeof newProps[prop] === 'function') {
        newProps[prop] = newProps[prop].bind(this);
      }
    });

    const uuid = this.createUUID();
    props[uuid] = newProps;
    return `key = ${uuid}`;
  }

  disconnectedCallback() {
    delete props[this.key];
  }

  render() {
    // overriden by child components
  }
}
