import helpIconSource from '../../assets/icons/help-252.svg?raw';
import doneIconSource from '../../assets/icons/check-252.svg?raw';

import { TinyBase } from '../base';
import { HIDE_PANEL, SHOW_PANEL } from '../../store/actionTypes';
import { canSubmit, validateDiary } from '../../validation/validateDiary';
import { studyConfig } from '../../config/appConfig';
import { t } from '../../i18n/i18n';

import './submissionStatus.css';

const VALIDATION_PANEL = 'validation';

const NO_RULES = 'no-rules';
const READY = 'ready';
const NOT_READY = 'not-ready';
const ACCESSIBLE_NAMES = {
  [NO_RULES]: 'submissionStatus.name.noRules',
  [READY]: 'submissionStatus.name.ready',
  [NOT_READY]: 'submissionStatus.name.notReady',
};

// The submission status button in the nav bar. It opens and closes the
// validation panel (el-validation-panel), and its icon says whether the viewed
// day's Diary can be submitted: a check mark when no hard check is failing,
// otherwise (and when the study has no active rules to check) a question mark.
// Not to be confused with SyncStatus (el-sync-status), beside it: that one
// says whether the Diary has been saved to the server.
export class SubmissionStatus extends TinyBase {
  store = super.getStore();
  readiness;

  connectedCallback() {
    super.connectedCallback();
    this.statusButton = this.querySelector('button');
    this.statusButton.addEventListener('click', () => this.toggle());
    this.registerCleanup(this.store.subscribe(() => this.update()));
    this.update();
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
    this.statusButton.setAttribute('aria-expanded', String(this.isPanelOpen()));
    this.updateReadiness();
  }

  // the viewed day's Diary against the study's active rules. Only the icon
  // and name are touched, and only when the state changes, so the button
  // keeps focus
  updateReadiness() {
    const { diaries, currentDate } = this.store.getState();
    const results = validateDiary(diaries[currentDate], studyConfig());
    const state = results.length === 0 ? NO_RULES : canSubmit(results) ? READY : NOT_READY;
    if (state === this.readiness) return;
    this.readiness = state;
    this.statusButton.innerHTML = state === READY ? doneIconSource : helpIconSource;
    this.statusButton.setAttribute('aria-label', t(ACCESSIBLE_NAMES[state]));
  }

  render() {
    this.innerHTML = `
            <button id="submission-status-button" class="reset-to-div" type="button" aria-label="${t(ACCESSIBLE_NAMES[NO_RULES])}" aria-controls="validation-panel" aria-expanded="false">
            ${helpIconSource}
            </button>
            `;
  }
}

customElements.define('el-submission-status', SubmissionStatus);
