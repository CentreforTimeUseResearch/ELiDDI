// A Respondent's copy of their diary on this device, and what is known about
// how it relates to the server (docs/adr/0007-server-sync-model.md, "Local
// state is keyed by Respondent id"). The diary itself is saved by
// persistStore under state.<respondentId>; the sync bookkeeping sits beside it
// under state.<respondentId>.sync, so a change can be marked unsynced before
// its own write happens and a crash between the two only ever leaves an extra
// push, never a lost one.

import { clearPersistedState, loadPersistedState, stateKeyFor } from '../store/persistence';

const metaKey = (respondentId) => `${stateKeyFor(respondentId)}.sync`;

// -> { state, revision, dirty, base } | null
//   state:    the saved slices that were readable
//   revision: the last server revision this copy is known to match (0: none)
//   dirty:    there may be changes the server has not got. True unless the
//             bookkeeping says otherwise, since "unknown" must never be
//             mistaken for "safe to overwrite".
//   base:     { [date]: fingerprint } of the Diaries as the server last held
//             them when this device agreed with it ({} if unknown); see
//             reconcile.js
export function readLocalCopy(storage, respondentId) {
  if (!storage) {
    return null;
  }
  const state = loadPersistedState(storage, stateKeyFor(respondentId));
  if (state === undefined) {
    return null;
  }
  let meta = null; // stays null when the bookkeeping is missing or unreadable
  try {
    meta = JSON.parse(storage.getItem(metaKey(respondentId)) ?? 'null');
  } catch {
    // unknown, which readLocalCopy treats as "may have unsent changes"
  }
  const known = Number.isInteger(meta?.revision) && typeof meta?.dirty === 'boolean';
  return {
    state,
    revision: known ? meta.revision : 0,
    dirty: known ? meta.dirty : true,
    base: known && meta.base && typeof meta.base === 'object' ? meta.base : {},
  };
}

export function writeSyncMeta(storage, respondentId, { revision, dirty, base = {} }) {
  try {
    storage?.setItem(metaKey(respondentId), JSON.stringify({ revision, dirty, base }));
  } catch (error) {
    console.error('Could not save the sync bookkeeping:', error);
  }
}

// Removes this Respondent's copy from the device. Backups made when a copy was
// overwritten (state.<id>.backup.*) are deliberately left: they are the one
// place an overwritten version still exists.
export function clearLocalCopy(storage, respondentId) {
  if (!storage) {
    return;
  }
  clearPersistedState(storage, stateKeyFor(respondentId));
  clearPersistedState(storage, metaKey(respondentId));
}

// Keeps the versions of Diaries that the server's copy replaced
export function saveBackup(storage, respondentId, replacedLocal, now = Date.now()) {
  if (!storage || Object.keys(replacedLocal).length === 0) {
    return null;
  }
  const key = `${stateKeyFor(respondentId)}.backup.${now}`;
  try {
    storage.setItem(key, JSON.stringify({ diaries: replacedLocal }));
    return key;
  } catch (error) {
    console.error(`Could not keep a backup of the replaced diary in "${key}":`, error);
    return null;
  }
}
