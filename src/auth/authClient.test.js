import { describe, it, expect, vi } from 'vitest';
import { describeLoginFailure, getAccounts, login, logout, signOut } from './authClient';
import { createSession } from './session';

const BACKEND = 'https://diary.example.org';
const reply = (status, body, headers = {}) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name] ?? null },
    json: async () => body,
  });
const LOGIN_BODY = { token: 'tok', respondentId: 'r-1', expiresAt: '2030-01-01T00:00:00Z' };

describe('getAccounts', () => {
  it.each([
    ['no general', {}],
    ['no setting', { general: {} }],
    ['false', { general: { server_accounts: false, backend_url: BACKEND } }],
    ['"true" as text', { general: { server_accounts: 'true', backend_url: BACKEND } }],
    ['on without a url', { general: { server_accounts: true } }],
    ['no config at all', undefined],
  ])('is off for %s', (_, config) => {
    expect(getAccounts(config).enabled).toBe(false);
  });

  it('is on when the flag is true and there is a backend_url', () => {
    expect(getAccounts({ general: { server_accounts: true, backend_url: BACKEND } })).toEqual({
      enabled: true,
      backendUrl: BACKEND,
    });
  });

  it('drops trailing slashes from the backend_url', () => {
    const config = { general: { server_accounts: true, backend_url: `${BACKEND}/api//` } };

    expect(getAccounts(config).backendUrl).toBe(`${BACKEND}/api`);
  });
});

describe('login', () => {
  it('POSTs the code as JSON to /login and returns the login', async () => {
    const fetchFn = reply(200, LOGIN_BODY);

    const result = await login({ backendUrl: BACKEND, code: 'abcd-efgh', fetchFn });

    expect(result).toEqual({ ok: true, ...LOGIN_BODY });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${BACKEND}/login`);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ code: 'abcd-efgh' });
  });

  it('trims the code but otherwise sends it as typed', async () => {
    const fetchFn = reply(200, LOGIN_BODY);

    await login({ backendUrl: BACKEND, code: '  ab cd-EFGH \n', fetchFn });

    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({ code: 'ab cd-EFGH' });
  });

  it.each(['', '   ', undefined, null, 5])('makes no request for the code %j', async (code) => {
    const fetchFn = reply(200, LOGIN_BODY);

    expect(await login({ backendUrl: BACKEND, code, fetchFn })).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('reports an unknown code', async () => {
    const result = await login({
      backendUrl: BACKEND,
      code: 'ZZZZZZZZ',
      fetchFn: reply(401, { error: 'invalid code' }),
    });

    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('reports too many attempts, with how long to wait', async () => {
    const result = await login({
      backendUrl: BACKEND,
      code: 'x',
      fetchFn: reply(429, {}, { 'Retry-After': '540' }),
    });

    expect(result).toEqual({ ok: false, reason: 'rate-limited', retryAfterSeconds: 540 });
  });

  it.each([undefined, 'soon', '0', '-5'])('copes with a Retry-After of %j', async (value) => {
    const result = await login({
      backendUrl: BACKEND,
      code: 'x',
      fetchFn: reply(429, {}, value === undefined ? {} : { 'Retry-After': value }),
    });

    expect(result).toEqual({ ok: false, reason: 'rate-limited', retryAfterSeconds: null });
  });

  it('reports a request that could not be made', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await login({ backendUrl: BACKEND, code: 'x', fetchFn })).toEqual({
      ok: false,
      reason: 'network',
    });
  });

  it.each([400, 500, 503])('reports a %s as a server problem', async (status) => {
    expect(await login({ backendUrl: BACKEND, code: 'x', fetchFn: reply(status, {}) })).toEqual({
      ok: false,
      reason: 'server',
      status,
    });
  });

  it.each([{}, { token: 'a' }, { token: '', respondentId: 'r', expiresAt: 'x' }, null])(
    'does not trust a 200 whose body is %j',
    async (body) => {
      const result = await login({ backendUrl: BACKEND, code: 'x', fetchFn: reply(200, body) });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('server');
    }
  );

  it('does not trust a 200 whose body is not JSON', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => {
        throw new SyntaxError('bad');
      },
    });

    expect((await login({ backendUrl: BACKEND, code: 'x', fetchFn })).reason).toBe('server');
  });

  it('uses the global fetch by default', async () => {
    const stub = reply(200, LOGIN_BODY);
    vi.stubGlobal('fetch', stub);
    try {
      expect((await login({ backendUrl: BACKEND, code: 'x' })).ok).toBe(true);
      expect(stub).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('logout and signOut', () => {
  it('POSTs to /logout with the bearer token', async () => {
    const fetchFn = reply(204, null);

    expect(await logout({ backendUrl: BACKEND, token: 'tok', fetchFn })).toBe(true);

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${BACKEND}/logout`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('never throws when the request fails', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('offline'));

    expect(await logout({ backendUrl: BACKEND, token: 'tok', fetchFn })).toBe(false);
  });

  const config = { general: { server_accounts: true, backend_url: `${BACKEND}/` } };
  const loggedIn = () => {
    const session = createSession({ storage: undefined });
    session.start(LOGIN_BODY);
    return session;
  };

  it('ends the login locally and then on the server', async () => {
    const session = loggedIn();
    const fetchFn = reply(204, null);

    await signOut({ session, config, fetchFn });

    expect(session.get()).toBeNull();
    expect(fetchFn.mock.calls[0][0]).toBe(`${BACKEND}/logout`);
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
  });

  it('has ended the login locally even when the server cannot be reached', async () => {
    const session = loggedIn();
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('offline'));

    await signOut({ session, config, fetchFn });

    expect(session.get()).toBeNull();
  });

  it('makes no request when nobody is logged in', async () => {
    const fetchFn = reply(204, null);

    await signOut({ session: createSession({ storage: undefined }), config, fetchFn });

    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('describeLoginFailure', () => {
  it.each([
    [{ reason: 'empty' }, 'Enter your login code.'],
    [{ reason: 'invalid' }, 'That code was not recognised. Check it and try again.'],
    [
      { reason: 'rate-limited', retryAfterSeconds: 540 },
      'Too many attempts. Please wait 9 minutes and try again.',
    ],
    [
      { reason: 'rate-limited', retryAfterSeconds: 61 },
      'Too many attempts. Please wait 2 minutes and try again.',
    ],
    [
      { reason: 'rate-limited', retryAfterSeconds: 30 },
      'Too many attempts. Please wait 1 minute and try again.',
    ],
    [
      { reason: 'rate-limited', retryAfterSeconds: null },
      'Too many attempts. Please wait a few minutes and try again.',
    ],
    [{ reason: 'network' }, 'Could not reach the server. Check your connection and try again.'],
    [
      { reason: 'server', status: 500 },
      'Something went wrong on the server. Please try again later.',
    ],
  ])('says the right thing for %j', (result, expected) => {
    expect(describeLoginFailure(result)).toBe(expected);
  });
});
