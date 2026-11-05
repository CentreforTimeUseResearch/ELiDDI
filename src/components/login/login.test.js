import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { appSession } from '../../auth/session';
import { appSyncStatus, SYNC_STATUS } from '../../sync/syncStatus';
import './login';

const BACKEND = 'https://diary.example.org';
const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const LOGIN_BODY = { token: 'tok', respondentId: 'r-1', expiresAt: FUTURE };

let originalGeneral;

function reply(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name] ?? null },
    json: async () => body,
  };
}

function mount() {
  const el = document.createElement('el-login');
  document.body.appendChild(el);
  return {
    el,
    form: el.querySelector('form'),
    input: el.querySelector('input'),
    button: el.querySelector('button[type="submit"]'),
    error: el.querySelector('[data-login-error]'),
    notice: el.querySelector('[data-login-notice]'),
  };
}

const submit = async (ui, code) => {
  ui.input.value = code;
  ui.form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  // let the stubbed fetch and the handler's awaits settle
  await vi.waitFor(() => expect(ui.button.disabled).toBe(false));
};

describe('Login', () => {
  beforeEach(() => {
    originalGeneral = GLOBALS.DATA.general;
    GLOBALS.DATA.general = {
      ...originalGeneral,
      server_accounts: true,
      backend_url: `${BACKEND}/`,
    };
    document.body.innerHTML = '';
    appSession.end('logout');
  });

  afterEach(() => {
    GLOBALS.DATA.general = originalGeneral;
    appSession.end('logout');
    vi.unstubAllGlobals();
  });

  describe('the form', () => {
    it('has a labelled text input for the code, tuned for typing a short code', () => {
      const { el, input } = mount();

      expect(el.querySelector(`label[for="${input.id}"]`).textContent).toBe('Login code');
      expect(input.type).toBe('text');
      expect(input.getAttribute('autocomplete')).toBe('off');
      expect(input.getAttribute('autocapitalize')).toBe('off');
      expect(input.getAttribute('autocorrect')).toBe('off');
      expect(input.getAttribute('spellcheck')).toBe('false');
      expect(input.hasAttribute('maxlength')).toBe(false);
    });

    it('describes the input with the format hint and the error', () => {
      const { input } = mount();
      const ids = input.getAttribute('aria-describedby').split(' ');

      expect(ids).toHaveLength(2);
      ids.forEach((id) => expect(document.getElementById(id)).not.toBeNull());
    });

    it('announces errors through an alert region that is there from the start', () => {
      const { error } = mount();

      expect(error.getAttribute('role')).toBe('alert');
      expect(error.textContent).toBe('');
    });

    it('can be submitted with the keyboard (a real submit button in a form)', () => {
      const { form, button } = mount();

      expect(button.type).toBe('submit');
      expect(form.contains(button)).toBe(true);
    });
  });

  describe('logging in', () => {
    it('sends the code to the backend and starts the session', async () => {
      const fetchStub = vi.fn().mockResolvedValue(reply(200, LOGIN_BODY));
      vi.stubGlobal('fetch', fetchStub);
      const ui = mount();

      await submit(ui, 'abcd-efgh');

      expect(fetchStub.mock.calls[0][0]).toBe(`${BACKEND}/login`);
      expect(JSON.parse(fetchStub.mock.calls[0][1].body)).toEqual({ code: 'abcd-efgh' });
      expect(appSession.get()).toEqual({ respondentId: 'r-1', expiresAt: FUTURE });
      expect(appSession.getToken()).toBe('tok');
    });

    it('empties the field once logged in, so the code is not left behind', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(200, LOGIN_BODY)));
      const ui = mount();

      await submit(ui, 'ABCD-EFGH');

      expect(ui.input.value).toBe('');
    });

    it('disables the button while the request is out, and says so', async () => {
      let finish;
      vi.stubGlobal(
        'fetch',
        vi.fn(() => new Promise((resolve) => (finish = resolve)))
      );
      const ui = mount();
      ui.input.value = 'ABCD-EFGH';

      ui.form.dispatchEvent(new Event('submit', { cancelable: true }));

      expect(ui.button.disabled).toBe(true);
      expect(ui.form.getAttribute('aria-busy')).toBe('true');
      expect(ui.button.textContent).toBe('Logging in…');

      finish(reply(401, {}));
      await vi.waitFor(() => expect(ui.button.disabled).toBe(false));
      expect(ui.form.getAttribute('aria-busy')).toBe('false');
      expect(ui.button.textContent).toBe('Log in');
    });

    it('does not send a second request while one is out', async () => {
      let finish;
      const fetchStub = vi.fn(() => new Promise((resolve) => (finish = resolve)));
      vi.stubGlobal('fetch', fetchStub);
      const ui = mount();
      ui.input.value = 'ABCD-EFGH';

      ui.form.dispatchEvent(new Event('submit', { cancelable: true }));
      ui.form.dispatchEvent(new Event('submit', { cancelable: true }));

      expect(fetchStub).toHaveBeenCalledOnce();
      finish(reply(401, {}));
      await vi.waitFor(() => expect(ui.button.disabled).toBe(false));
    });

    it('stops the browser submitting the form itself', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(401, {})));
      const ui = mount();
      const event = new Event('submit', { cancelable: true });
      ui.input.value = 'X';

      ui.form.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      await vi.waitFor(() => expect(ui.button.disabled).toBe(false));
    });
  });

  describe('when it fails', () => {
    it.each([
      [
        'an unknown code',
        () => reply(401, {}),
        'That code was not recognised. Check it and try again.',
      ],
      [
        'too many attempts',
        () => reply(429, {}, { 'Retry-After': '540' }),
        'Too many attempts. Please wait 9 minutes and try again.',
      ],
      [
        'a server error',
        () => reply(500, {}),
        'Something went wrong on the server. Please try again later.',
      ],
    ])('shows the message for %s and starts no session', async (_, makeReply, message) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeReply()));
      const ui = mount();

      await submit(ui, 'ZZZZ-ZZZZ');

      expect(ui.error.textContent).toBe(message);
      expect(appSession.get()).toBeNull();
    });

    it('shows a network failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      const ui = mount();

      await submit(ui, 'ABCD-EFGH');

      expect(ui.error.textContent).toBe(
        'Could not reach the server. Check your connection and try again.'
      );
    });

    it('asks for a code without making a request when the field is empty', async () => {
      const fetchStub = vi.fn();
      vi.stubGlobal('fetch', fetchStub);
      const ui = mount();

      await submit(ui, '   ');

      expect(fetchStub).not.toHaveBeenCalled();
      expect(ui.error.textContent).toBe('Enter your login code.');
    });

    it('marks the field invalid, keeps what was typed, and puts the cursor back in it', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(401, {})));
      const ui = mount();

      await submit(ui, 'ZZZZ-ZZZZ');

      expect(ui.input.getAttribute('aria-invalid')).toBe('true');
      expect(ui.input.value).toBe('ZZZZ-ZZZZ');
      expect(document.activeElement).toBe(ui.input);
    });

    it('clears the error and the invalid mark on the next attempt', async () => {
      const fetchStub = vi
        .fn()
        .mockResolvedValueOnce(reply(401, {}))
        .mockResolvedValueOnce(reply(200, LOGIN_BODY));
      vi.stubGlobal('fetch', fetchStub);
      const ui = mount();

      await submit(ui, 'WRONG-ONE');
      await submit(ui, 'ABCD-EFGH');

      expect(ui.error.textContent).toBe('');
      expect(ui.input.hasAttribute('aria-invalid')).toBe(false);
    });
  });

  describe('when a login ends', () => {
    it('empties the field and the error, so the next person starts clean', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(401, {})));
      const ui = mount();
      await submit(ui, 'SOMEONE-ELSES');

      appSession.start({ token: 't', respondentId: 'r', expiresAt: FUTURE });
      appSession.end('logout');

      expect(ui.input.value).toBe('');
      expect(ui.error.textContent).toBe('');
      expect(ui.input.hasAttribute('aria-invalid')).toBe(false);
    });

    it.each([
      ['logout', 'You have logged out.'],
      ['expired', 'Your session has ended. Please log in again.'],
    ])('says why after a %s', (reason, message) => {
      const ui = mount();

      appSession.start({ token: 't', respondentId: 'r', expiresAt: FUTURE });
      appSession.end(reason);

      expect(ui.notice.textContent).toBe(message);
      expect(ui.notice.getAttribute('role')).toBe('status');
    });

    it('drops the notice when the Respondent tries again', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(401, {})));
      const ui = mount();
      appSession.start({ token: 't', respondentId: 'r', expiresAt: FUTURE });
      appSession.end('expired');

      await submit(ui, 'ABCD-EFGH');

      expect(ui.notice.textContent).toBe('');
    });
  });

  // #208: while the diary is being fetched, the form gives way to a message
  describe('while the diary is not ready', () => {
    afterEach(() => {
      appSyncStatus.set(SYNC_STATUS.IDLE);
      appSyncStatus.setRetryHandler(null);
    });

    it('shows the form and no gate normally', () => {
      const ui = mount();

      expect(ui.form.hidden).toBe(false);
      expect(ui.el.querySelector('[data-login-gate]').hidden).toBe(true);
    });

    it('says the diary is loading, in place of the form, with a way to log out', () => {
      const ui = mount();

      appSyncStatus.set(SYNC_STATUS.LOADING);

      expect(ui.form.hidden).toBe(true);
      expect(ui.el.querySelector('[data-login-gate-text]').textContent).toBe('Loading your diary…');
      expect(ui.el.querySelector('[data-gate="logout"]')).not.toBeNull();
      expect(ui.el.querySelector('[data-gate="retry"]')).toBeNull();
    });

    it('offers to try again when the diary could not be loaded, and asks the manager to', () => {
      const retry = vi.fn();
      appSyncStatus.setRetryHandler(retry);
      const ui = mount();
      appSyncStatus.set(SYNC_STATUS.LOAD_FAILED);

      ui.el.querySelector('[data-gate="retry"]').click();

      expect(ui.el.querySelector('[data-login-gate-text]').textContent).toContain(
        'could not be loaded'
      );
      expect(retry).toHaveBeenCalledOnce();
    });

    it('asks for a reload when this page is too old to open the diary', () => {
      const ui = mount();

      appSyncStatus.set(SYNC_STATUS.OUTDATED);

      expect(ui.el.querySelector('[data-login-gate-text]').textContent).toContain('out of date');
      expect(ui.el.querySelector('[data-gate="reload"]').textContent).toBe('Reload the page');
    });

    it('logs out from the gate, so someone else can use the device', () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));
      const ui = mount();
      appSession.start({ token: 't', respondentId: 'r', expiresAt: FUTURE });
      appSyncStatus.set(SYNC_STATUS.LOAD_FAILED);

      ui.el.querySelector('[data-gate="logout"]').click();

      expect(appSession.get()).toBeNull();
    });

    it('goes back to the form when the diary is ready', () => {
      const ui = mount();
      appSyncStatus.set(SYNC_STATUS.LOADING);

      appSyncStatus.set(SYNC_STATUS.SAVED);

      expect(ui.form.hidden).toBe(false);
      expect(ui.el.querySelector('[data-login-gate]').hidden).toBe(true);
    });
  });

  it('stops listening to the session once it is removed from the page', () => {
    const ui = mount();
    ui.el.remove();
    ui.input.value = 'typed';

    appSession.start({ token: 't', respondentId: 'r', expiresAt: FUTURE });
    appSession.end('logout');

    expect(ui.input.value).toBe('typed');
  });
});
