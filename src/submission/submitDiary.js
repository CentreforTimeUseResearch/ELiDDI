// Sends one Diary to the study's server (docs/adr/0006-diary-submission-payload.md).
// It only sends: marking the Diary complete, and what the Respondent sees
// afterwards, are the caller's job. Never throws for a failed request - the
// caller gets a result and the Diary in the browser is left as it was.

import { getAccounts } from '../auth/authClient';
import { appSession } from '../auth/session';

// Where a completed Diary goes: { url, authenticated } | null when nowhere.
// Without server accounts it is general.submit_completed_diary_url, as ever.
// With them it is always the ELiDDI backend's own /submit, with the login
// token, and submit_completed_diary_url is ignored: the token must never be
// sent to a URL the study config merely names.
export function getSubmitTarget(config) {
  const accounts = getAccounts(config);
  if (accounts.enabled) {
    return { url: `${accounts.backendUrl}/submit`, authenticated: true };
  }
  const url = config?.general?.submit_completed_diary_url;
  return url ? { url, authenticated: false } : null;
}

// -> { ok: true }
//  | { ok: false, reason: 'no-diary' | 'no-url' | 'network' }
//  | { ok: false, reason: 'http', status }   (the server answered, not 2xx)
//  | { ok: false, reason: 'unauthorized' }   (accounts on, and nobody is logged
//                                             in or the server refused the token:
//                                             the login is ended so the Respondent
//                                             is asked to log in; the Diary stays)
//
// diary is the Diary for `date` (a YYYY-MM-DD key), config is the study config
// (src/config/appConfig.js's studyConfig() for the running study's), session
// is the login to use (the page's own by default)
export async function submitDiary({ diary, date, config, session = appSession }) {
  if (!diary) {
    return { ok: false, reason: 'no-diary' };
  }
  const target = getSubmitTarget(config);
  if (!target) {
    return { ok: false, reason: 'no-url' };
  }
  const headers = { 'Content-Type': 'application/json' };
  if (target.authenticated) {
    const token = session.getToken();
    if (!token) {
      return { ok: false, reason: 'unauthorized' };
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(target.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildPayload({ diary, date, config })),
    });
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (target.authenticated && response.status === 401) {
    session.end('expired');
    return { ok: false, reason: 'unauthorized' };
  }
  return response.ok ? { ok: true } : { ok: false, reason: 'http', status: response.status };
}

// offsets are minutes from the Day boundary, so it travels with them
function buildPayload({ diary, date, config }) {
  return {
    experimentID: config.general.experimentID,
    version: config.general.version,
    dayBoundary: config.day_boundary,
    date,
    status: diary.status,
    timelines: diary.timelines,
  };
}
