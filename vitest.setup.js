import activities from './config/activities.json';

// The app is normally bootstrapped by scripts/generate_no_js.js injecting
// `GLOBALS = {DATA: <activities.json>}` as an inline script before any
// component code runs (see index.html / src/main.js). Components read this
// global directly, so tests need the same global available before any
// custom element is defined/constructed.
globalThis.GLOBALS = { DATA: activities };

// jsdom does not implement <dialog>'s showModal()/close() - stub them so
// components that call into a real <dialog> element don't throw in tests.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
  }
}
