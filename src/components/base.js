import { appStore } from '../store/appStore';
import * as propsRegistry from './propsRegistry';

export class TinyBase extends HTMLElement {
  key;
  cleanupFns = [];

  constructor() {
    super();
  }

  // components register teardown for anything that outlives a single
  // render (timers, store subscriptions, manually-added listeners) here,
  // instead of hand-rolling their own disconnectedCallback override
  registerCleanup(cleanupFn) {
    this.cleanupFns.push(cleanupFn);
  }

  connectedCallback() {
    this.key = this.getAttribute('key');
    this.props = this.getProps(this.key);
    this.render();
  }

  getProps(key) {
    return propsRegistry.getProps(key);
  }

  getStore() {
    return appStore;
  }

  setProps(newProps, returnKey = false) {
    return propsRegistry.setProps(this, newProps, returnKey);
  }

  disconnectedCallback() {
    propsRegistry.deleteProps(this.key);
    this.cleanupFns.forEach((cleanupFn) => cleanupFn());
    this.cleanupFns = [];
  }

  render() {
    // overriden by child components
  }
}
