import doneIconSource from '../../assets/icons/check-252.svg?raw';
import crossIconSource from '../../assets/icons/cross-252.svg?raw';

import '../dialogWidget/dialogWidget';

import { TinyBase } from '../base';
import { HIDE_PANEL, SET_COMPLETE } from '../../store/actionTypes';
import { DIARY_STATUS } from '../../store/diaryStatus';
import { canSubmit, validateDiary } from '../../validation/validateDiary';
import { submitDiary } from '../../submission/submitDiary';
import { escapeHtml } from '../../utils/html';

import './validationPanel.css';

const PANEL_NAME = 'validation';

// what the Respondent is told when a submission fails
function describeFailure({ reason, status }) {
  switch (reason) {
    case 'network':
      return 'The Diary could not be sent. Check your connection and try again.';
    case 'http':
      return `The server could not accept the Diary (error ${status}). Try again in a moment.`;
    default:
      return 'There is no Diary to send yet.';
  }
}

// The right-hand panel listing the study's active Validation rules for the
// viewed day's Diary, each passed or failed. Opened by the help button in
// el-contextual-help through the store's `uipanel` ('validation'); closed by
// the same button, Escape, its close button or a click outside.
//
// At the bottom is the "Diary complete" button, when the study has somewhere
// to submit to. It is disabled while a hard check fails; failing soft checks
// are listed in a confirm dialog first ("are you sure?"). A successful
// submission marks the Diary complete (and redirects, if the study has a
// primary_redirect_url); a failed one says so and leaves it in progress so the
// Respondent can try again.
export class ValidationPanel extends TinyBase {
  // render() builds the shell once; the list is redrawn as the Diary changes
  static renderOnce = true;

  store = super.getStore();
  isOpen = false;
  confirmDialogActions;
  isConfirming = false;
  isSending = false;
  submitError; // { date, text } of the last failed submission
  renderedResults;

  connectedCallback() {
    super.connectedCallback();
    this.panel = this.querySelector('.validation-panel');
    this.list = this.querySelector('.validation-list');
    this.completeButton = this.querySelector('.validation-complete');
    this.completeHint = this.querySelector('.validation-complete-hint');
    this.submitStatus = this.querySelector('.validation-submit-status');
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
    this.updateActions(results);
    const serialized = JSON.stringify(results);
    if (serialized === this.renderedResults) return;
    this.renderedResults = serialized;

    this.list.innerHTML =
      results.length === 0
        ? '<li class="validation-empty">No checks are set for this study.</li>'
        : results.map((result) => this.renderResult(result)).join('');
  }

  // the button is shown only when the study has a submit URL (the rules above
  // work either way), and is disabled while a hard check fails or a request
  // is in flight. Below it, what happened to the viewed day's submission.
  updateActions(results) {
    const { diaries, currentDate } = this.store.getState();
    const hasSubmitUrl = Boolean(GLOBALS.DATA.general?.submit_completed_diary_url);
    const blocked = !canSubmit(results);
    this.completeButton.hidden = !hasSubmitUrl;
    this.completeButton.disabled = blocked || this.isSending;
    this.completeButton.textContent = this.isSending ? 'Sending…' : 'Diary complete';
    this.completeHint.hidden = !hasSubmitUrl || !blocked;

    const failed = this.submitError?.date === currentDate;
    const complete = diaries[currentDate]?.status === DIARY_STATUS.COMPLETE;
    const [text, state] = failed
      ? [this.submitError.text, 'error']
      : complete && hasSubmitUrl
        ? ['This Diary has been submitted. Thank you.', 'success']
        : ['', ''];
    // only touched when it changes, so a screen reader announces it once
    if (this.submitStatus.textContent !== text) {
      this.submitStatus.textContent = text;
      this.submitStatus.dataset.state = state;
    }
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

  async submit() {
    if (this.isSending) return;
    // the day being viewed can change while the request is out
    const { diaries, currentDate: date } = this.store.getState();
    this.isSending = true;
    this.submitError = undefined;
    this.updateActions(this.getResults());

    const result = await submitDiary({ diary: diaries[date], date, config: GLOBALS.DATA });

    this.isSending = false;
    if (result.ok) {
      this.store.dispatch({ type: SET_COMPLETE, payload: { date } });
      const redirectUrl = GLOBALS.DATA.general?.primary_redirect_url;
      if (redirectUrl) this.redirect(redirectUrl);
    } else {
      this.submitError = { date, text: describeFailure(result) };
    }
    this.updateActions(this.getResults());
  }

  redirect(url) {
    window.location.assign(url);
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
          <p class="validation-submit-status" role="status"></p>
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
