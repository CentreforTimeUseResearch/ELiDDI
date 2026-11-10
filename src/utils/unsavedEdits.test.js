import { describe, it, expect, vi } from 'vitest';
import { registerUnsavedEditsGuard, guardUnsavedEdits } from './unsavedEdits';

// The seam between what leaves the details panel (a click on another Entry, a
// change of day, Escape) and the panel's coordinator, which knows whether
// anything unsaved would be lost.
describe('guardUnsavedEdits', () => {
  it('lets the action go ahead at once when nothing is registered', () => {
    const proceed = vi.fn();

    guardUnsavedEdits({}, proceed);

    expect(proceed).toHaveBeenCalledOnce();
  });

  it('hands the scope, the action and what to do if it is not taken to the registered guard', () => {
    const guard = vi.fn();
    const unregister = registerUnsavedEditsGuard(guard);
    const proceed = vi.fn();
    const onCancel = vi.fn();

    guardUnsavedEdits({ all: true }, proceed, onCancel);

    expect(guard).toHaveBeenCalledWith({ all: true }, proceed, onCancel);
    expect(proceed).not.toHaveBeenCalled(); // the guard decides, and may ask first
    unregister();
  });

  it('lets the guard run the action now, or later', () => {
    const unregister = registerUnsavedEditsGuard((scope, proceed) => proceed());
    const proceed = vi.fn();

    guardUnsavedEdits({}, proceed);

    expect(proceed).toHaveBeenCalledOnce();
    unregister();
  });

  it('goes back to letting everything through once the guard is unregistered', () => {
    const unregister = registerUnsavedEditsGuard(vi.fn());
    unregister();
    const proceed = vi.fn();

    guardUnsavedEdits({}, proceed);

    expect(proceed).toHaveBeenCalledOnce();
  });

  it('is replaced by a later guard, and the first one unregistering does not remove the second', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unregisterFirst = registerUnsavedEditsGuard(first);
    const unregisterSecond = registerUnsavedEditsGuard(second);

    unregisterFirst();
    guardUnsavedEdits({}, vi.fn());

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    unregisterSecond();
  });

  it('is fine with no scope given', () => {
    const guard = vi.fn();
    const unregister = registerUnsavedEditsGuard(guard);

    guardUnsavedEdits(undefined, vi.fn());

    expect(guard).toHaveBeenCalledWith({}, expect.any(Function), undefined);
    unregister();
  });
});
