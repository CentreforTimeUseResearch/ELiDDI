import { appStore } from '../store/appStore';
import * as propsRegistry from './propsRegistry';

export class TinyBase extends HTMLElement {
  key;
  cleanupFns = [];

  constructor() {
    super();
    // every render() replaces this component's previous markup, so first
    // free the props it handed out to that markup (see propsRegistry.js).
    // Wrapped here, once, so subclasses can keep calling this.render()
    // directly (e.g. DetailsPanel.reset()) without remembering to release
    const renderMarkup = this.render;
    this.render = (...args) => {
      this.releaseOwnedProps();
      return renderMarkup.apply(this, args);
    };
  }

  // components register teardown for anything that outlives a single
  // render (timers, store subscriptions, manually-added listeners) here,
  // instead of hand-rolling their own disconnectedCallback override
  registerCleanup(cleanupFn) {
    this.cleanupFns.push(cleanupFn);
  }

  connectedCallback() {
    this.resolveProps();
    this.render();
  }

  // props are resolved on first connect and kept: on a reconnect (a DOM
  // move) the parent may already have released the key
  resolveProps() {
    this.key = this.getAttribute('key');
    this.props = this.getProps(this.key) ?? this.props;
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

  // for a component that replaces part of its markup outside render()
  // (e.g. ActivityPicker.renderAccordion())
  releaseOwnedProps() {
    propsRegistry.releaseAllOwnedBy(this);
  }

  disconnectedCallback() {
    this.releaseOwnedProps();
    this.cleanupFns.forEach((cleanupFn) => cleanupFn());
    this.cleanupFns = [];
  }

  render() {
    // overriden by child components
  }
}
