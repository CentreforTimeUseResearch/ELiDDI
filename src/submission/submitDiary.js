// Sends one Diary to the study's server (docs/adr/0006-diary-submission-payload.md).
// It only sends: marking the Diary complete, and what the Respondent sees
// afterwards, are the caller's job. Never throws for a failed request - the
// caller gets a result and the Diary in the browser is left as it was.

// -> { ok: true }
//  | { ok: false, reason: 'no-diary' | 'no-url' | 'network' }
//  | { ok: false, reason: 'http', status }   (the server answered, not 2xx)
//
// diary is the Diary for `date` (a YYYY-MM-DD key), config is the study config
// (GLOBALS.DATA)
export async function submitDiary({ diary, date, config }) {
  if (!diary) {
    return { ok: false, reason: 'no-diary' };
  }
  const url = config?.general?.submit_completed_diary_url;
  if (!url) {
    return { ok: false, reason: 'no-url' };
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload({ diary, date, config })),
    });
  } catch {
    return { ok: false, reason: 'network' };
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
