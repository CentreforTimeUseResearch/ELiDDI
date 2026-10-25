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

  // Lifecycle rule - anything that outlives a single render is set up in
  // connectedCallback and torn down through registerCleanup, which
  // disconnectedCallback runs:
  //   - listeners on `this`, `document` or `window`: use listen()
  //   - timers, store subscriptions, helper objects that own timers
  //     (e.g. EntryResizeController.destroy): registerCleanup()
  // Listeners on elements this component's own render() creates may be
  // bound directly in render(): they are discarded with that markup.
  registerCleanup(cleanupFn) {
    this.cleanupFns.push(cleanupFn);
  }

  // addEventListener, removed again when this component disconnects
  listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.registerCleanup(() => target.removeEventListener(type, handler, options));
  }

  // A component sets `static renderOnce = true` when its markup must survive
  // a DOM move: it renders on first connect only, and a reconnect keeps that
  // markup (with whatever state it holds), re-running just the rest of its
  // connectedCallback - so listeners and subscriptions, which disconnect
  // tore down, must be set up there, per the lifecycle rule above. Every
  // other component re-renders on each connect.
  connectedCallback() {
    this.resolveProps();
    if (this.constructor.renderOnce && this.hasRendered) {
      return;
    }
    this.render();
    this.hasRendered = true;
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
