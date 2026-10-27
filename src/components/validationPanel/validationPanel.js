import doneIconSource from '../../assets/icons/check-252.svg?raw';
import crossIconSource from '../../assets/icons/cross-252.svg?raw';

import '../dialogWidget/dialogWidget';

import { TinyBase } from '../base';
import { HIDE_PANEL } from '../../store/actionTypes';
import { canSubmit, validateDiary } from '../../validation/validateDiary';
import { submitDiary } from '../../submission/submitDiary';
import { escapeHtml } from '../../utils/html';

import './validationPanel.css';

const PANEL_NAME = 'validation';

// The right-hand panel listing the study's active Validation rules for the
// viewed day's Diary, each passed or failed. Opened by the help button in
// el-contextual-help through the store's `uipanel` ('validation'); closed by
// the same button, Escape, its close button or a click outside.
//
// At the bottom is the "Diary complete" button, when the study has somewhere
// to submit to. It is disabled while a hard check fails; failing soft checks
// are listed in a confirm dialog first ("are you sure?").
export class ValidationPanel extends TinyBase {
  // render() builds the shell once; the list is redrawn as the Diary changes
  static renderOnce = true;

  store = super.getStore();
  isOpen = false;
  confirmDialogActions;
  isConfirming = false;
  renderedResults;

  connectedCallback() {
    super.connectedCallback();
    this.panel = this.querySelector('.validation-panel');
    this.list = this.querySelector('.validation-list');
    this.completeButton = this.querySelector('.validation-complete');
    this.completeHint = this.querySelector('.validation-complete-hint');
    this.softFailures = this.querySelector('.validation-soft-failures');

    this.querySelector('.validation-header [data-close]').addEventListener('click', () =>
      this.requestClose()
    );
    this.completeButton.addEventListener('click', () => this.onCompleteClick());
    this.querySelector('el-dialog').addEventListener('click', (event) => {
      if (event.target.closest('[data-confirm-submit]')) {
        this.confirmDialogActions.close();
        this.isConfirming = false;
        this.submit();
      }
    });
    this.listen(document, 'keydown', (event) => {
      // Escape in the confirm dialog only cancels that dialog
      if (this.isOpen && !this.isConfirming && event.key === 'Escape') this.requestClose();
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
    this.updateCompleteButton(results);

    this.list.innerHTML =
      results.length === 0
        ? '<li class="validation-empty">No checks are set for this study.</li>'
        : results.map((result) => this.renderResult(result)).join('');
  }

  // shown only when the study has a submit URL; the rules above work either way
  updateCompleteButton(results) {
    const hasSubmitUrl = Boolean(GLOBALS.DATA.general?.submit_completed_diary_url);
    const blocked = !canSubmit(results);
    this.completeButton.hidden = !hasSubmitUrl;
    this.completeButton.disabled = blocked;
    this.completeHint.hidden = !hasSubmitUrl || !blocked;
  }

  onCompleteClick() {
    const results = this.getResults();
    if (!canSubmit(results)) return;
    const failedSoft = results.filter((result) => result.level === 'soft' && !result.passed);
    if (failedSoft.length === 0) {
      this.submit();
      return;
    }
    this.softFailures.innerHTML = failedSoft
      .map(
        ({ title, message }) =>
          `<li><strong>${escapeHtml(title)}</strong> ${escapeHtml(message)}</li>`
      )
      .join('');
    this.isConfirming = true;
    this.confirmDialogActions.open();
  }

  // the outcome is handled by a later change; for now it is only logged
  async submit() {
    const { diaries, currentDate } = this.store.getState();
    const result = await submitDiary({
      diary: diaries[currentDate],
      date: currentDate,
      config: GLOBALS.DATA,
    });
    console.log('Diary submission:', result);
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
        <div class="validation-actions">
          <p class="validation-complete-hint" id="validation-complete-hint" hidden>
            The checks that are not marked as advice must pass before you can complete this Diary.
          </p>
          <button type="button" class="validation-complete" aria-describedby="validation-complete-hint" hidden>
            Diary complete
          </button>
        </div>
        <el-dialog ${this.setProps({
          registerDialogActions: (actions) => {
            this.confirmDialogActions = actions;
          },
          content: `<h4>Are you sure?</h4>
            <p>These checks are not met:</p>
            <ul class="validation-soft-failures"></ul>
            <button type="button" class="validation-confirm" data-confirm-submit>Submit anyway</button>`,
          closeLabel: 'Go back',
          onRequestClose: () => {
            this.isConfirming = false;
            this.confirmDialogActions.close();
          },
        })}></el-dialog>
      </section>`;
  }
}

customElements.define('el-validation-panel', ValidationPanel);
