import helpIconSource from '../../assets/icons/help-252.svg?raw';
import doneIconSource from '../../assets/icons/check-252.svg?raw';

import { TinyBase } from '../base';
import { HIDE_PANEL, SHOW_PANEL } from '../../store/actionTypes';
import { canSubmit, validateDiary } from '../../validation/validateDiary';

import './contextualHelp.css';

const ID = 'id';
const VALIDATION_PANEL = 'validation';

const NO_RULES = 'no-rules';
const READY = 'ready';
const NOT_READY = 'not-ready';
const ACCESSIBLE_NAMES = {
  [NO_RULES]: 'Diary checks',
  [READY]: 'Diary checks: ready to submit',
  [NOT_READY]: 'Diary checks: not ready',
};

// The help button in the nav bar. It opens and closes the validation panel
// (el-validation-panel), and its icon says whether the viewed day's Diary can
// be submitted: a check mark when no hard check is failing, otherwise (and
// when the study has no active rules to check) a question mark.
export class ContextualHelp extends TinyBase {
  static observedAttributes = [ID];

  store = super.getStore();
  readiness;

  connectedCallback() {
    super.connectedCallback();
    this.helpButton = this.querySelector('button');
    this.helpButton.addEventListener('click', () => this.toggle());
    this.registerCleanup(this.store.subscribe(() => this.update()));
    this.update();
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

  update() {
    this.helpButton.setAttribute('aria-expanded', String(this.isPanelOpen()));
    this.updateReadiness();
  }

  // the viewed day's Diary against the study's active rules. Only the icon
  // and name are touched, and only when the state changes, so the button
  // keeps focus
  updateReadiness() {
    const { diaries, currentDate } = this.store.getState();
    const results = validateDiary(diaries[currentDate], GLOBALS.DATA);
    const state = results.length === 0 ? NO_RULES : canSubmit(results) ? READY : NOT_READY;
    if (state === this.readiness) return;
    this.readiness = state;
    this.helpButton.innerHTML = state === READY ? doneIconSource : helpIconSource;
    this.helpButton.setAttribute('aria-label', ACCESSIBLE_NAMES[state]);
  }

  render() {
    this.innerHTML = `
            <button id="help-button-${this[ID]}" class="reset-to-div" type="button" aria-label="Diary checks" aria-controls="validation-panel" aria-expanded="false">
            ${helpIconSource}
            </button>
            `;
  }
}

customElements.define('el-contextual-help', ContextualHelp);
