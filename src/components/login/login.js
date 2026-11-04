import { TinyBase } from '../base';
import { appSession } from '../../auth/session';
import { describeLoginFailure, getAccounts, login } from '../../auth/authClient';
import './login.css';

// What the Respondent is told above the form after a login has ended
const NOTICES = {
  logout: 'You have logged out.',
  expired: 'Your session has ended. Please log in again.',
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
  busy = false;

  connectedCallback() {
    super.connectedCallback();
    this.registerCleanup(
      appSession.subscribe((session, reason) => this.onSession(session, reason))
    );
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
    `;
    this.form = this.querySelector('form');
    this.input = this.querySelector('input');
    this.button = this.querySelector('.login-submit');
    this.errorElement = this.querySelector('[data-login-error]');
    this.noticeElement = this.querySelector('[data-login-notice]');
    this.form.addEventListener('submit', (event) => this.submit(event));
  }
}

customElements.define('el-login', Login);
