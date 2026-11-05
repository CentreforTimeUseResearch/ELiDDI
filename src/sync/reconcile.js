// Merging this device's copy of a Respondent's state with the server's, when
// they differ (docs/adr/0007-server-sync-model.md, "Reconciling on a 409").
// Pure functions: nothing here touches the store, storage or the network.

import { DIARY_STATUS } from '../store/diaryStatus';

// JSON with object keys in a fixed order, so two Diaries with the same
// content compare equal however their keys happened to be ordered
function canonical(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export const sameContent = (a, b) => canonical(a) === canonical(b);

// A short fingerprint of a Diary (FNV-1a over its canonical JSON). Kept per
// date as the "base": what the server held when this device last agreed with
// it, so a later merge can tell which side changed a day.
export function fingerprint(value) {
  let hash = 0x811c9dc5;
  const text = canonical(value);
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
}

// { [date]: fingerprint } for a set of Diaries
export const baseOf = (diaries) =>
  Object.fromEntries(Object.entries(diaries).map(([date, diary]) => [date, fingerprint(diary)]));

// local, server: { onboarding, diaries } (the synced part of the state)
// base: { [date]: fingerprint } of the Diaries as the server last held them
//       when this device agreed with it ({} if unknown)
// -> {
//      state:   { onboarding, diaries }  what both sides should now hold,
//      replacedLocal: { [date]: Diary }  this device's Diaries the server's copy
//                                        beat (to be kept as a backup)
//    }
//
// Per Diary date:
//   - on one side only, or equal on both: kept
//   - different on both, and only one side changed it since the base: that
//     side's version (this is the usual case: a device edits one day, another
//     device edits a different day, and the first must not lose its edit)
//   - changed on both sides (or no base to tell): a complete Diary (status
//     100) beats an in-progress one, because completing it is something the
//     Respondent did on purpose; otherwise the server's copy wins and this
//     device's is handed back to be kept as a backup
// Onboarding counts as done if either side finished it.
export function mergeStates(local, server, base = {}) {
  const diaries = { ...local.diaries };
  const replacedLocal = {};

  Object.entries(server.diaries).forEach(([date, serverDiary]) => {
    const localDiary = local.diaries[date];
    if (localDiary === undefined || sameContent(localDiary, serverDiary)) {
      diaries[date] = serverDiary;
      return;
    }
    const localChanged = fingerprint(localDiary) !== base[date];
    const serverChanged = fingerprint(serverDiary) !== base[date];
    if (!localChanged) {
      diaries[date] = serverDiary;
      return;
    }
    if (!serverChanged) {
      diaries[date] = localDiary;
      return;
    }
    const localComplete = localDiary.status === DIARY_STATUS.COMPLETE;
    const serverComplete = serverDiary.status === DIARY_STATUS.COMPLETE;
    if (localComplete && !serverComplete) {
      diaries[date] = localDiary;
      return;
    }
    diaries[date] = serverDiary;
    replacedLocal[date] = localDiary;
  });

  return {
    state: { onboarding: local.onboarding && server.onboarding, diaries },
    replacedLocal,
  };
}
