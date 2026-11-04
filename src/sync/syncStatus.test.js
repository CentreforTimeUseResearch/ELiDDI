import { describe, it, expect, vi } from 'vitest';
import { BLOCKS_DIARY, createSyncStatus, SYNC_STATUS } from './syncStatus';

describe('createSyncStatus', () => {
  it('starts idle', () => {
    expect(createSyncStatus().get()).toBe(SYNC_STATUS.IDLE);
  });

  it('tells subscribers when the status changes, and only then', () => {
    const status = createSyncStatus();
    const listener = vi.fn();
    status.subscribe(listener);

    status.set(SYNC_STATUS.SAVING);
    status.set(SYNC_STATUS.SAVING);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(SYNC_STATUS.SAVING);
  });

  it('stops telling a subscriber that unsubscribed', () => {
    const status = createSyncStatus();
    const listener = vi.fn();

    status.subscribe(listener)();
    status.set(SYNC_STATUS.SAVED);

    expect(listener).not.toHaveBeenCalled();
  });

  it('passes "Try again" to whatever the manager registered', () => {
    const status = createSyncStatus();
    const retry = vi.fn();
    status.setRetryHandler(retry);

    status.retry();

    expect(retry).toHaveBeenCalledOnce();
  });

  it('does nothing on "Try again" before a handler is registered', () => {
    expect(() => createSyncStatus().retry()).not.toThrow();
  });
});

describe('BLOCKS_DIARY', () => {
  it('holds exactly the statuses in which the diary must not be shown', () => {
    expect([...BLOCKS_DIARY].sort()).toEqual(
      [SYNC_STATUS.LOADING, SYNC_STATUS.LOAD_FAILED, SYNC_STATUS.OUTDATED].sort()
    );
  });
});
