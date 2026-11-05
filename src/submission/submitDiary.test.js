import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSubmitTarget, submitDiary } from './submitDiary';

const URL = 'https://example.org/api/diaries';
const config = {
  day_boundary: '04:00',
  general: { experimentID: 'exp-1', version: '2.0.0', submit_completed_diary_url: URL },
};
const entry = { id: 1, startOffsetMins: 0, endOffsetMins: 1440, activity: 'Sleeping' };
const diary = { timelines: [[entry], []], status: 0 };

let fetchStub;
const respondWith = (status) =>
  fetchStub.mockResolvedValue({ ok: status >= 200 && status < 300, status });

describe('submitDiary', () => {
  beforeEach(() => {
    fetchStub = vi.fn();
    respondWith(200);
    vi.stubGlobal('fetch', fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the documented JSON to the configured URL', async () => {
    await submitDiary({ diary, date: '2025-01-01', config });

    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [url, init] = fetchStub.mock.calls[0];
    expect(url).toBe(URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({
      experimentID: 'exp-1',
      version: '2.0.0',
      dayBoundary: '04:00',
      date: '2025-01-01',
      status: 0,
      timelines: [[entry], []],
    });
  });

  it('sends the status the Diary has', async () => {
    await submitDiary({ diary: { ...diary, status: 100 }, date: '2025-01-01', config });

    expect(JSON.parse(fetchStub.mock.calls[0][1].body).status).toBe(100);
  });

  it('gives success for a 2xx response', async () => {
    respondWith(204);

    expect(await submitDiary({ diary, date: '2025-01-01', config })).toEqual({ ok: true });
  });

  it.each([400, 404, 500])(
    'gives a failure carrying the status for a %i response',
    async (status) => {
      respondWith(status);

      expect(await submitDiary({ diary, date: '2025-01-01', config })).toEqual({
        ok: false,
        reason: 'http',
        status,
      });
    }
  );

  it('gives a network failure, rather than throwing, when fetch rejects', async () => {
    fetchStub.mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await submitDiary({ diary, date: '2025-01-01', config })).toEqual({
      ok: false,
      reason: 'network',
    });
  });

  it.each([
    ['an empty', ''],
    ['a missing', undefined],
  ])('makes no request with %s submit URL', async (_, url) => {
    const noUrl = { ...config, general: { ...config.general, submit_completed_diary_url: url } };

    expect(await submitDiary({ diary, date: '2025-01-01', config: noUrl })).toEqual({
      ok: false,
      reason: 'no-url',
    });
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('makes no request without a Diary', async () => {
    expect(await submitDiary({ diary: undefined, date: '2025-01-01', config })).toEqual({
      ok: false,
      reason: 'no-diary',
    });
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

describe('with server accounts on', () => {
  const BACKEND = 'https://diary.example.org';
  const accountsConfig = {
    ...config,
    general: { ...config.general, server_accounts: true, backend_url: BACKEND + '/' },
  };
  const send = (session) =>
    submitDiary({ diary, date: '2025-01-01', config: accountsConfig, session });
  let session;

  beforeEach(() => {
    fetchStub = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetchStub);
    session = { getToken: vi.fn(() => 'secret-token'), end: vi.fn() };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to the backend /submit with the token', async () => {
    expect(await send(session)).toEqual({ ok: true });

    const [url, init] = fetchStub.mock.calls[0];
    expect(url).toBe(BACKEND + '/submit');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer secret-token',
    });
    expect(JSON.parse(init.body).date).toBe('2025-01-01');
  });

  it('sends the token to no other URL, even when submit_completed_diary_url is set', async () => {
    await send(session);

    expect(fetchStub.mock.calls.map(([url]) => url)).toEqual([BACKEND + '/submit']);
  });

  it('submits even when the study has no submit_completed_diary_url', async () => {
    const noUrl = { ...accountsConfig, general: { ...accountsConfig.general } };
    delete noUrl.general.submit_completed_diary_url;

    expect(await submitDiary({ diary, date: '2025-01-01', config: noUrl, session })).toEqual({
      ok: true,
    });
  });

  it('treats a 401 as "log in again": ends the login and keeps the Diary', async () => {
    fetchStub.mockResolvedValue({ ok: false, status: 401 });

    expect(await send(session)).toEqual({ ok: false, reason: 'unauthorized' });

    expect(session.end).toHaveBeenCalledWith('expired');
    expect(diary.timelines[0]).toEqual([entry]);
  });

  it('makes no request when nobody is logged in', async () => {
    session.getToken.mockReturnValue(null);

    expect(await send(session)).toEqual({ ok: false, reason: 'unauthorized' });
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('reports other failures as before, without ending the login', async () => {
    fetchStub.mockResolvedValue({ ok: false, status: 500 });
    expect(await send(session)).toEqual({ ok: false, reason: 'http', status: 500 });
    expect(session.end).not.toHaveBeenCalled();

    fetchStub.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await send(session)).toEqual({ ok: false, reason: 'network' });
  });
});

describe('with server accounts off', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('never sends an Authorization header, whatever the session holds', async () => {
    fetchStub = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchStub);
    const session = { getToken: vi.fn(() => 'secret-token'), end: vi.fn() };

    await submitDiary({ diary, date: '2025-01-01', config, session });

    expect(fetchStub.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
    expect(session.getToken).not.toHaveBeenCalled();
  });

  it('does not end the login on a 401 (the URL is not ours)', async () => {
    fetchStub = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetchStub);
    const session = { getToken: vi.fn(), end: vi.fn() };

    expect(await submitDiary({ diary, date: '2025-01-01', config, session })).toEqual({
      ok: false,
      reason: 'http',
      status: 401,
    });
    expect(session.end).not.toHaveBeenCalled();
  });
});

describe('getSubmitTarget', () => {
  it('is the configured URL, unauthenticated, without accounts', () => {
    expect(getSubmitTarget(config)).toEqual({ url: URL, authenticated: false });
  });

  it('is nothing without accounts and without a URL', () => {
    expect(getSubmitTarget({ general: {} })).toBeNull();
  });

  it('is the backend /submit, authenticated, with accounts', () => {
    expect(
      getSubmitTarget({ general: { server_accounts: true, backend_url: 'https://b.example/api/' } })
    ).toEqual({ url: 'https://b.example/api/submit', authenticated: true });
  });

  it('ignores server_accounts without a backend_url', () => {
    expect(getSubmitTarget({ general: { server_accounts: true } })).toBeNull();
  });
});
