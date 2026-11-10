import { TinyBase } from '../base';
import { appSession } from '../../auth/session';
import { describeLoginFailure, getAccounts, login } from '../../auth/authClient';
import { requestLogout } from '../../sync/appSync';
import { appSyncStatus, SYNC_STATUS } from '../../sync/syncStatus';
import { t } from '../../i18n/i18n';
import './login.css';

// What the Respondent is told above the form after a login has ended.
// Catalogue keys, not strings (ADR 0008): t() runs at use time, so the
// language is read then, not at module evaluation.
const NOTICES = {
  logout: 'login.notice.logout',
  expired: 'login.notice.expired',
};

// What the dialog says, instead of the form, while the Respondent is logged in
// but their diary is not on screen yet (or must not be touched). Logging out
// is always offered, so someone else can use the device.
const GATES = {
  [SYNC_STATUS.LOADING]: { text: 'login.gate.loading', button: null },
  [SYNC_STATUS.LOAD_FAILED]: {
    text: 'login.gate.loadFailed',
    button: { action: 'retry', label: 'login.gate.retry' },
  },
  [SYNC_STATUS.OUTDATED]: {
    text: 'login.gate.outdated',
    button: { action: 'reload', label: 'login.gate.reload' },
  },
};

// The login form, shown in a dialog while server accounts are on and nobody is
// logged in (see DynamicTimelineUI). The same URL goes to every Respondent, so
// they identify themselves with a login code (8 letters and numbers, shown as
// ABCD-EFGH). The code is only ever sent to the backend: it is not stored, and
// the field is emptied after a successful login and when a login ends, so the
// next person on a shared device does not find it.
export class Login extends TinyBase {
  static renderOnce = true;

  form;
  input;
  button;
  errorElement;
  noticeElement;
  gateElement;
  gateText;
  gateButtons;
  busy = false;

  connectedCallback() {
    super.connectedCallback();
    this.registerCleanup(
      appSession.subscribe((session, reason) => this.onSession(session, reason))
    );
    this.registerCleanup(appSyncStatus.subscribe(() => this.showGate()));
    this.showGate();
  }

  // While the diary is being fetched (or cannot be used) the form gives way to
  // a message
  showGate() {
    const gate = GATES[appSyncStatus.get()];
    this.form.hidden = Boolean(gate);
    this.gateElement.hidden = !gate;
    if (!gate) {
      return;
    }
    this.gateText.textContent = t(gate.text);
    const main = gate.button
      ? `<button type="button" class="login-submit" data-gate="${gate.button.action}">${t(gate.button.label)}</button>`
      : '';
    this.gateButtons.innerHTML = `${main}<button type="button" class="login-secondary" data-gate="logout">${t('login.gate.logout')}</button>`;
  }

  onGateClick(event) {
    const action = event.target.closest('[data-gate]')?.dataset.gate;
    if (action === 'retry') {
      appSyncStatus.retry();
    } else if (action === 'reload') {
      globalThis.location.reload();
    } else if (action === 'logout') {
      requestLogout();
    }
  }

  onSession(session, reason) {
    if (session === null) {
      this.input.value = '';
      this.showError('');
      this.noticeElement.textContent = reason in NOTICES ? t(NOTICES[reason]) : '';
    }
  }

  showError(message) {
    this.errorElement.textContent = message;
    if (message) {
      this.input.setAttribute('aria-invalid', 'true');
    } else {
      this.input.removeAttribute('aria-invalid');
    }
  }

  setBusy(busy) {
    this.busy = busy;
    this.button.disabled = busy;
    this.button.textContent = busy ? t('login.submitting') : t('login.submit');
    this.form.setAttribute('aria-busy', String(busy));
  }

  async submit(event) {
    event.preventDefault();
    if (this.busy) {
      return;
    }
    this.setBusy(true);
    this.showError('');
    this.noticeElement.textContent = '';

    const { backendUrl } = getAccounts(globalThis.GLOBALS?.DATA);
    const result = await login({ backendUrl, code: this.input.value });
    this.setBusy(false);

    if (result.ok) {
      this.input.value = '';
      appSession.start(result);
      return;
    }
    this.showError(describeLoginFailure(result));
    this.input.focus();
    this.input.select();
  }

  render() {
    this.innerHTML = `
      <form class="login-form" novalidate>
        <h4 id="login-title">${t('login.title')}</h4>
        <p class="login-notice" data-login-notice role="status"></p>
        <label class="login-label" for="login-code">${t('login.codeLabel')}</label>
        <p class="login-hint" id="login-code-hint">
          ${t('login.codeHint')}
        </p>
        <input
          type="text"
          id="login-code"
          class="login-input"
          name="login-code"
          inputmode="text"
          enterkeyhint="go"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          autofocus
          aria-describedby="login-code-hint login-error"
        />
        <p class="login-error" id="login-error" data-login-error role="alert"></p>
        <button type="submit" class="login-submit">${t('login.submit')}</button>
      </form>
      <div class="login-gate" data-login-gate hidden>
        <p class="login-gate-text" data-login-gate-text role="status"></p>
        <div class="login-gate-buttons" data-login-gate-buttons></div>
      </div>
    `;
    this.form = this.querySelector('form');
    this.input = this.querySelector('input');
    this.button = this.querySelector('.login-submit');
    this.errorElement = this.querySelector('[data-login-error]');
    this.noticeElement = this.querySelector('[data-login-notice]');
    this.gateElement = this.querySelector('[data-login-gate]');
    this.gateText = this.querySelector('[data-login-gate-text]');
    this.gateButtons = this.querySelector('[data-login-gate-buttons]');
    this.form.addEventListener('submit', (event) => this.submit(event));
    this.gateElement.addEventListener('click', (event) => this.onGateClick(event));
  }
}

customElements.define('el-login', Login);
