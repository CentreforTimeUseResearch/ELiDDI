import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitDiary } from './submitDiary';

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
