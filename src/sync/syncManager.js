// Keeps a Respondent's diary in step with the server while they are logged in
// (docs/adr/0007-server-sync-model.md). It follows the login session:
//
//   login   fetch the server's copy, reconcile it with this device's copy of
//           that Respondent, put the result in the store, then save every
//           change locally at once and to the server after a short quiet period
//   expiry  keep the copy, stop sending (the diary is hidden behind the login
//           dialog until the Respondent logs in again)
//   logout  empty the store, send what is unsent, then remove the local copy
//
// The diary never waits for the network: the local copy is written first, and
// the server follows. Everything outside (store, session, storage, fetch,
// timers) is passed in so it can be tested without a browser.

import { REPLACE_STATE } from '../store/actionTypes';
import {
  persistStore,
  restoreSyncedState,
  stateKeyFor,
  STATE_VERSION,
  SYNCED_KEYS,
} from '../store/persistence';
import { baseOf, mergeStates } from './reconcile';
import { fetchState, pushState } from './syncClient';
import { clearLocalCopy, readLocalCopy, saveBackup, writeSyncMeta } from './localCopy';
import { NOTICE_KIND, SYNC_STATUS } from './syncStatus';

// slices that travel with a Respondent's copy on this device but are never sent
const DEVICE_KEYS = ['onboardingStep', 'currentDate'];
// conflicts in a row before we stop hammering the server and back off
const MAX_CONFLICTS_IN_A_ROW = 5;

// the dates a merge took from the server over this device's version
const noticeAbout = (replacedLocal, earlier) => {
  const dates = new Set([...(earlier?.dates ?? []), ...Object.keys(replacedLocal)]);
  return { kind: NOTICE_KIND.REPLACED, dates: [...dates].sort() };
};

const hasAny = (object) => Object.keys(object).length > 0;
const pick = (source, keys) =>
  Object.fromEntries(keys.filter((key) => source?.[key] !== undefined).map((k) => [k, source[k]]));
const syncedWithDefaults = (source) => ({
  onboarding: true,
  diaries: {},
  ...pick(source, SYNCED_KEYS),
});
// what goes into the store for a copy: its synced slices and its device-local ones
const storePayload = (copy) => pick(copy.state, [...SYNCED_KEYS, ...DEVICE_KEYS]);

export function createSync({
  store,
  session,
  storage,
  backendUrl,
  status,
  fetchFn,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
  debounceMs = 2000,
  retryStartMs = 5000,
  retryMaxMs = 60000,
}) {
  let active = null; // the Respondent whose diary is in the store
  let epoch = 0; // bumped whenever a login is superseded, so stale answers are dropped
  let retryDelay = retryStartMs;
  let failedLoad = null; // { id, token } for "Try again" when nothing could be shown
  let unsubscribeSession = null;

  const syncedRefs = () => {
    const { onboarding, diaries } = store.getState();
    return { onboarding, diaries };
  };
  const requestOptions = (token) => ({ backendUrl, token, fetchFn });
  const hasChangedSince = (before) => {
    const now = syncedRefs();
    return SYNCED_KEYS.some((key) => now[key] !== before[key]);
  };

  // --- the active Respondent -------------------------------------------------

  // Puts a Respondent's diary in the store and starts saving and watching it.
  // copy: { state, revision, dirty }; the store gets storePayload(copy)
  function attach(id, token, copy) {
    store.dispatch({ type: REPLACE_STATE, payload: storePayload(copy) });
    const entry = {
      id,
      token,
      revision: copy.revision,
      dirty: copy.dirty,
      base: copy.base ?? {},
      refs: syncedRefs(),
      pushTimer: null,
      retryTimer: null,
      needsLoad: false,
      pushing: false,
      inflight: null,
      blocked: false,
      conflicts: 0,
    };
    entry.stopSaving = storage ? persistStore(store, storage, { key: stateKeyFor(id) }) : () => {};
    entry.stopTracking = store.subscribe(() => onStoreChange(entry));
    writeSyncMeta(storage, id, entry);
    active = entry;
    return entry;
  }

  // stops watching and saving (finishing any write still due); the local copy
  // is left exactly as it is
  function detach(entry) {
    clearTimer(entry.pushTimer);
    clearTimer(entry.retryTimer);
    entry.pushTimer = null;
    entry.retryTimer = null;
    entry.stopTracking();
    entry.stopSaving();
  }

  function onStoreChange(entry) {
    if (!hasChangedSince(entry.refs)) {
      return; // only device-local or transient state changed
    }
    entry.refs = syncedRefs();
    entry.dirty = true;
    writeSyncMeta(storage, entry.id, entry);
    if (entry.blocked || !entry.token) {
      return;
    }
    if (entry.retryTimer === null) {
      status.set(SYNC_STATUS.SAVING);
      schedulePush(entry, debounceMs);
    }
  }

  function schedulePush(entry, delay) {
    clearTimer(entry.pushTimer);
    entry.pushTimer = setTimer(() => push(entry), delay);
  }

  // after a failure: try again later, waiting longer each time
  function scheduleRetry(entry) {
    clearTimer(entry.pushTimer);
    entry.pushTimer = null;
    clearTimer(entry.retryTimer);
    entry.retryTimer = setTimer(() => {
      entry.retryTimer = null;
      if (entry.needsLoad) {
        reload(entry);
      } else {
        push(entry);
      }
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, retryMaxMs);
    status.set(SYNC_STATUS.UNSAVED);
  }

  // --- sending -----------------------------------------------------------------

  async function push(entry) {
    if (active !== entry || !entry.token || entry.pushing || entry.blocked || !entry.dirty) {
      return;
    }
    clearTimer(entry.pushTimer);
    entry.pushTimer = null;
    let releaseInflight;
    entry.pushing = true;
    entry.inflight = new Promise((resolve) => {
      releaseInflight = resolve;
    });
    status.set(SYNC_STATUS.SAVING);

    const sent = syncedRefs();
    const result = await pushState({
      ...requestOptions(entry.token),
      baseRevision: entry.revision,
      stateVersion: STATE_VERSION,
      state: sent,
    });
    entry.pushing = false;
    releaseInflight();
    if (active !== entry) {
      return;
    }

    switch (result.kind) {
      case 'ok':
        entry.revision = result.revision;
        entry.base = baseOf(sent.diaries);
        entry.conflicts = 0;
        retryDelay = retryStartMs;
        entry.dirty = hasChangedSince(sent);
        writeSyncMeta(storage, entry.id, entry);
        if (entry.dirty) {
          schedulePush(entry, debounceMs); // changed while the request was out
        } else {
          status.set(SYNC_STATUS.SAVED);
        }
        break;
      case 'conflict':
        resolveConflict(entry, result);
        break;
      case 'unauthorized':
        entry.token = null;
        session.end('expired');
        break;
      case 'rejected':
        entry.blocked = true;
        status.set(SYNC_STATUS.REJECTED);
        break;
      default:
        scheduleRetry(entry);
    }
  }

  // The server holds a newer revision than the one we built on: merge its copy
  // with ours per Diary date and push the result (ADR 0007)
  function resolveConflict(entry, { revision, snapshot }) {
    entry.conflicts += 1;
    entry.revision = revision;
    if (snapshot) {
      const server = readServerSnapshot(snapshot);
      if (server.synced === null) {
        entry.blocked = true;
        status.set(server.outdated ? SYNC_STATUS.OUTDATED : SYNC_STATUS.REJECTED);
        return;
      }
      const { state: merged, replacedLocal } = mergeStates(syncedRefs(), server.synced, entry.base);
      saveBackup(storage, entry.id, replacedLocal);
      if (hasAny(replacedLocal)) {
        status.setNotice(noticeAbout(replacedLocal, status.getNotice()));
      }
      entry.base = baseOf(server.synced.diaries);
      const { currentDate, onboardingStep } = store.getState();
      store.dispatch({ type: REPLACE_STATE, payload: { ...merged, currentDate, onboardingStep } });
    }
    entry.dirty = true;
    writeSyncMeta(storage, entry.id, entry);
    if (entry.conflicts >= MAX_CONFLICTS_IN_A_ROW) {
      entry.conflicts = 0;
      scheduleRetry(entry);
    } else {
      schedulePush(entry, 0);
    }
  }

  // -> { synced: { onboarding, diaries } } | { synced: null, outdated } when it
  // cannot be used: a newer format than this page understands (do not touch it),
  // or damaged (do not overwrite it with something derived from it)
  function readServerSnapshot({ stateVersion, state }) {
    if (stateVersion > STATE_VERSION) {
      return { synced: null, outdated: true };
    }
    const restored = restoreSyncedState(stateVersion, state);
    if (restored.problems.length > 0) {
      return { synced: null, outdated: false };
    }
    return { synced: syncedWithDefaults(restored.state) };
  }

  // --- logging in -------------------------------------------------------------------

  // Someone else is logging in, so the diary of the person before must leave the
  // screen, and their copy the device, unless it holds changes the server has
  // not got: that stays (hidden) until they log in again.
  function dismissActive() {
    const previous = active;
    active = null;
    detach(previous);
    store.dispatch({ type: REPLACE_STATE, payload: {} });
    if (!previous.dirty) {
      clearLocalCopy(storage, previous.id);
    }
  }

  // what this device holds for a Respondent whose diary is already in the store
  function copyFromActive(entry) {
    return {
      state: store.getState(),
      revision: entry.revision,
      dirty: entry.dirty,
      base: entry.base,
    };
  }

  async function beginLogin(id, token) {
    const myEpoch = ++epoch;
    failedLoad = null;
    let local;
    if (active?.id === id) {
      // the same person again after their login ran out: what is in the store
      // is their copy, whether or not storage could hold it
      local = copyFromActive(active);
      detach(active);
      active = null;
    } else {
      if (active) {
        dismissActive();
      }
      status.dismissNotice();
      local = readLocalCopy(storage, id);
    }
    status.set(SYNC_STATUS.LOADING);
    await load(id, token, local, myEpoch);
  }

  // a retry of a load that failed while this device's copy was on screen
  function reload(entry) {
    if (active !== entry || !entry.token) {
      return;
    }
    const myEpoch = ++epoch;
    const local = copyFromActive(entry);
    detach(entry);
    active = null;
    load(entry.id, entry.token, local, myEpoch);
  }

  // Fetch the server's copy and decide, per the table in the ADR, what the
  // Respondent sees. local: this device's copy of them, or null.
  async function load(id, token, local, myEpoch) {
    const result = await fetchState(requestOptions(token));
    if (myEpoch !== epoch) {
      return; // logged out, or someone else logged in, while we waited
    }

    if (result.kind === 'unauthorized') {
      if (local) {
        attach(id, null, local); // keep the copy; the login dialog takes over
      }
      session.end('expired');
      return;
    }

    if (result.kind === 'retry') {
      if (!local) {
        failedLoad = { id, token };
        status.set(SYNC_STATUS.LOAD_FAILED);
        return;
      }
      // work from this device's copy until the server answers
      const entry = attach(id, token, local);
      entry.needsLoad = true;
      scheduleRetry(entry);
      return;
    }

    if (result.kind === 'none') {
      if (local) {
        const entry = attach(id, token, { ...local, revision: 0, dirty: true, base: {} });
        push(entry);
      } else {
        attach(id, token, { state: {}, revision: 0, dirty: false, base: {} });
        status.set(SYNC_STATUS.SAVED);
      }
      return;
    }

    const server = readServerSnapshot(result);
    if (server.synced === null) {
      if (server.outdated) {
        status.set(SYNC_STATUS.OUTDATED);
      } else {
        failedLoad = { id, token };
        status.set(SYNC_STATUS.LOAD_FAILED);
      }
      return;
    }

    if (!local || !local.dirty) {
      // nothing here the server lacks: take its copy
      const state = { ...pick(local?.state, DEVICE_KEYS), ...server.synced };
      attach(id, token, {
        state,
        revision: result.revision,
        dirty: false,
        base: baseOf(server.synced.diaries),
      });
      status.set(SYNC_STATUS.SAVED);
      return;
    }

    const { state: merged, replacedLocal } = mergeStates(
      syncedWithDefaults(local.state),
      server.synced,
      local.base
    );
    saveBackup(storage, id, replacedLocal);
    if (hasAny(replacedLocal)) {
      status.setNotice(noticeAbout(replacedLocal, status.getNotice()));
    }
    const state = { ...pick(local.state, DEVICE_KEYS), ...merged };
    push(
      attach(id, token, {
        state,
        revision: result.revision,
        dirty: true,
        base: baseOf(server.synced.diaries), // what the server holds at that revision
      })
    );
  }

  // --- logging out and running out ------------------------------------------------------

  // The Respondent chose to leave. The store is emptied at once (the next
  // person must not see this diary), then what the server has not got is sent.
  async function beginLogout() {
    epoch += 1;
    failedLoad = null;
    status.dismissNotice();
    status.set(SYNC_STATUS.IDLE);
    const leaving = active;
    if (!leaving) {
      return;
    }
    active = null;
    const toSend = syncedRefs();
    detach(leaving);
    store.dispatch({ type: REPLACE_STATE, payload: {} });

    if (!leaving.dirty) {
      clearLocalCopy(storage, leaving.id);
      return;
    }
    if (!leaving.token) {
      return; // their login had already run out: the copy stays for their next one
    }
    const result = await pushState({
      ...requestOptions(leaving.token),
      baseRevision: leaving.revision,
      stateVersion: STATE_VERSION,
      state: toSend,
    });
    if (result.kind === 'ok') {
      clearLocalCopy(storage, leaving.id);
    }
    // anything else: the copy stays, still marked unsynced, for their next login
  }

  // The login ran out: keep the diary and the copy, stop sending. Whoever logs
  // in next decides what happens to it (beginLogin).
  function pause() {
    epoch += 1;
    status.set(SYNC_STATUS.IDLE);
    if (active) {
      active.token = null;
      clearTimer(active.pushTimer);
      clearTimer(active.retryTimer);
      active.pushTimer = null;
      active.retryTimer = null;
    }
  }

  function onSession(view, reason) {
    if (reason === 'login') {
      beginLogin(view.respondentId, session.getToken());
    } else if (reason === 'logout') {
      beginLogout();
    } else {
      pause();
    }
  }

  const api = {
    // follow the session; picks up a login that survived a page reload
    start() {
      unsubscribeSession = session.subscribe(onSession);
      status.setRetryHandler(api.retryLoad);
      const view = session.get();
      if (view) {
        beginLogin(view.respondentId, session.getToken());
      }
    },
    stop() {
      unsubscribeSession?.();
      if (active) {
        detach(active);
      }
    },
    // send what is unsent now, or try the load again: the page is being left,
    // or the connection or the tab is back
    flush() {
      if (!active?.token) {
        return;
      }
      clearTimer(active.retryTimer);
      active.retryTimer = null;
      if (active.needsLoad) {
        reload(active);
      } else {
        push(active);
      }
    },
    // Before logging out: get what the server lacks onto it, so the Respondent
    // can be told if that is not possible. Resolves true when there is nothing
    // unsent (so logging out loses nothing and keeps nothing hidden on this
    // device); false when something could not be sent.
    async settle() {
      const entry = active;
      if (!entry || !entry.dirty || !entry.token) {
        return true;
      }
      for (let attempt = 0; attempt < MAX_CONFLICTS_IN_A_ROW && entry.dirty; attempt += 1) {
        if (entry.blocked || active !== entry || !entry.token) {
          break;
        }
        clearTimer(entry.retryTimer);
        entry.retryTimer = null;
        if (entry.pushing) {
          await entry.inflight;
        } else {
          await push(entry);
        }
        if (entry.retryTimer !== null) {
          break; // the request failed; it was not just that more was typed meanwhile
        }
      }
      return active === entry && !entry.dirty;
    },
    // "Try again" when the diary could not be loaded at all
    retryLoad() {
      if (failedLoad) {
        beginLogin(failedLoad.id, failedLoad.token);
      }
    },
  };
  return api;
}
