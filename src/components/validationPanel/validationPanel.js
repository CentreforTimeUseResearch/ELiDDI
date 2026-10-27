import doneIconSource from '../../assets/icons/check-252.svg?raw';
import crossIconSource from '../../assets/icons/cross-252.svg?raw';

import { TinyBase } from '../base';
import { HIDE_PANEL } from '../../store/actionTypes';
import { validateDiary } from '../../validation/validateDiary';
import { escapeHtml } from '../../utils/html';

import './validationPanel.css';

const PANEL_NAME = 'validation';

// The right-hand panel listing the study's active Validation rules for the
// viewed day's Diary, each passed or failed. Opened by the help button in
// el-contextual-help through the store's `uipanel` ('validation'); closed by
// the same button, Escape, its close button or a click outside.
export class ValidationPanel extends TinyBase {
  // render() builds the shell once; the list is redrawn as the Diary changes
  static renderOnce = true;

  store = super.getStore();
  isOpen = false;
  renderedResults;

  connectedCallback() {
    super.connectedCallback();
    this.panel = this.querySelector('.validation-panel');
    this.list = this.querySelector('.validation-list');

    this.querySelector('[data-close]').addEventListener('click', () => this.requestClose());
    this.listen(document, 'keydown', (event) => {
      if (this.isOpen && event.key === 'Escape') this.requestClose();
    });
    this.listen(document, 'click', (event) => {
      // the help button toggles the panel itself, so is not an "outside" click
      if (this.isOpen && !event.target.closest('.validation-panel, el-contextual-help')) {
        this.requestClose();
      }
    });
    this.registerCleanup(this.store.subscribe(() => this.onStoreUpdate()));
    this.onStoreUpdate();
  }

  onStoreUpdate() {
    const { uipanel, onboarding } = this.store.getState();
    if (uipanel === PANEL_NAME && onboarding) {
      // the onboarding dialog is modal; do not leave the panel open behind it
      this.requestClose();
      return;
    }
    const shouldBeOpen = uipanel === PANEL_NAME;
    if (shouldBeOpen !== this.isOpen) {
      shouldBeOpen ? this.open() : this.close();
    }
    if (this.isOpen) {
      this.renderResults();
    }
  }

  requestClose() {
    this.store.dispatch({ type: HIDE_PANEL });
  }

  open() {
    this.isOpen = true;
    this.panel.classList.add('open');
    this.panel.removeAttribute('inert');
    this.renderResults();
    this.panel.focus();
  }

  close() {
    this.isOpen = false;
    // focus goes back to the help button, unless it already moved elsewhere
    // (e.g. into another panel that replaced this one)
    const focusWasHere = this.panel.contains(document.activeElement);
    this.panel.classList.remove('open');
    this.panel.setAttribute('inert', '');
    if (focusWasHere || document.activeElement === document.body) {
      document.querySelector('el-contextual-help button')?.focus();
    }
  }

  // the viewed day's Diary, checked against the rules the study has on
  getResults() {
    const { diaries, currentDate } = this.store.getState();
    return validateDiary(diaries[currentDate], GLOBALS.DATA);
  }

  renderResults() {
    const results = this.getResults();
    // the Diary changes on every Entry edit, the results rarely: leave the
    // markup alone unless they changed
    const serialized = JSON.stringify(results);
    if (serialized === this.renderedResults) return;
    this.renderedResults = serialized;

    this.list.innerHTML =
      results.length === 0
        ? '<li class="validation-empty">No checks are set for this study.</li>'
        : results.map((result) => this.renderResult(result)).join('');
  }

  renderResult({ title, level, passed, message }) {
    const advice = level === 'soft' ? ' <span class="validation-advice">(advice)</span>' : '';
    return `<li class="validation-result ${passed ? 'passed' : 'failed'}">
        <span class="validation-icon" aria-hidden="true">${passed ? doneIconSource : crossIconSource}</span>
        <span class="validation-text">
          <span class="validation-title">${escapeHtml(title)}${advice}
            <span class="sr-only">${passed ? 'passed' : 'failed'}</span></span>
          ${passed ? '' : `<span class="validation-message">${escapeHtml(message)}</span>`}
        </span>
      </li>`;
  }

  render() {
    this.innerHTML = `
      <section id="validation-panel" class="validation-panel" aria-labelledby="validation-panel-title" tabindex="-1" inert>
        <header class="validation-header">
          <h2 id="validation-panel-title">Checks</h2>
          <button type="button" class="reset-to-div" data-close aria-label="Close checks">&times;</button>
        </header>
        <ul class="validation-list"></ul>
        <div class="validation-actions"></div>
      </section>`;
  }
}

customElements.define('el-validation-panel', ValidationPanel);
