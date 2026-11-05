import { TinyBase } from '../base';
import { appSession } from '../../auth/session';
import { describeLoginFailure, getAccounts, login, signOut } from '../../auth/authClient';
import { appSyncStatus, SYNC_STATUS } from '../../sync/syncStatus';
import './login.css';

// What the Respondent is told above the form after a login has ended
const NOTICES = {
  logout: 'You have logged out.',
  expired: 'Your session has ended. Please log in again.',
};

// What the dialog says, instead of the form, while the Respondent is logged in
// but their diary is not on screen yet (or must not be touched). Logging out
// is always offered, so someone else can use the device.
const GATES = {
  [SYNC_STATUS.LOADING]: { text: 'Loading your diary…', button: null },
  [SYNC_STATUS.LOAD_FAILED]: {
    text: 'Your diary could not be loaded. Check your connection and try again.',
    button: { action: 'retry', label: 'Try again' },
  },
  [SYNC_STATUS.OUTDATED]: {
    text: 'This page is out of date and cannot open your diary safely. Reload the page to continue.',
    button: { action: 'reload', label: 'Reload the page' },
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
    this.gateText.textContent = gate.text;
    const main = gate.button
      ? `<button type="button" class="login-submit" data-gate="${gate.button.action}">${gate.button.label}</button>`
      : '';
    this.gateButtons.innerHTML = `${main}<button type="button" class="login-secondary" data-gate="logout">Log out</button>`;
  }

  onGateClick(event) {
    const action = event.target.closest('[data-gate]')?.dataset.gate;
    if (action === 'retry') {
      appSyncStatus.retry();
    } else if (action === 'reload') {
      globalThis.location.reload();
    } else if (action === 'logout') {
      signOut({ session: appSession, config: globalThis.GLOBALS?.DATA });
    }
  }

  onSession(session, reason) {
    if (session === null) {
      this.input.value = '';
      this.showError('');
      this.noticeElement.textContent = NOTICES[reason] ?? '';
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
    this.button.textContent = busy ? 'Logging in…' : 'Log in';
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
        <h4 id="login-title">Log in</h4>
        <p class="login-notice" data-login-notice role="status"></p>
        <label class="login-label" for="login-code">Login code</label>
        <p class="login-hint" id="login-code-hint">
          8 letters and numbers, like ABCD-EFGH. Capital letters and the hyphen are optional.
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
        <button type="submit" class="login-submit">Log in</button>
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
