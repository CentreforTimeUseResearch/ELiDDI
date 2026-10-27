import helpIconSource from '../../assets/icons/help-252.svg?raw';
import doneIconSource from '../../assets/icons/check-252.svg?raw';

import { TinyBase } from '../base';
import { HIDE_PANEL, SHOW_PANEL } from '../../store/actionTypes';

import './contextualHelp.css';

const ID = 'id';
const VALIDATION_PANEL = 'validation';

// The help button in the nav bar. It opens and closes the validation panel
// (el-validation-panel); the panel does the rest.
export class ContextualHelp extends TinyBase {
  static observedAttributes = [ID];

  store = super.getStore();
  done = true;

  connectedCallback() {
    super.connectedCallback();
    this.helpButton = this.querySelector('button');
    this.helpButton.addEventListener('click', () => this.toggle());
    this.registerCleanup(this.store.subscribe(() => this.updateExpanded()));
    this.updateExpanded();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this[name] !== newValue) {
      this[name] = newValue;
    }
  }

  isPanelOpen() {
    return this.store.getState().uipanel === VALIDATION_PANEL;
  }

  toggle() {
    this.store.dispatch(
      this.isPanelOpen() ? { type: HIDE_PANEL } : { type: SHOW_PANEL, payload: VALIDATION_PANEL }
    );
  }

  updateExpanded() {
    this.helpButton.setAttribute('aria-expanded', String(this.isPanelOpen()));
  }

  render() {
    this.innerHTML = `
            <button id="help-button-${this[ID]}" class="reset-to-div" type="button" aria-label="Checks" aria-controls="validation-panel" aria-expanded="false">
            ${this.done ? doneIconSource : helpIconSource}
            </button>
            `;
  }
}

customElements.define('el-contextual-help', ContextualHelp);
