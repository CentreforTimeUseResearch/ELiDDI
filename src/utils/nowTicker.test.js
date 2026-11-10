import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onHalfMinuteTick } from './nowTicker';

describe('onHalfMinuteTick', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs one interval however many subscribers there are', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onHalfMinuteTick(a);
    const offB = onHalfMinuteTick(b);

    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(30000);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    offA();
    offB();
  });

  it('stops the interval when the last subscriber leaves, and only then', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onHalfMinuteTick(a);
    const offB = onHalfMinuteTick(b);

    offA();
    expect(vi.getTimerCount()).toBe(1); // b still needs it
    vi.advanceTimersByTime(30000);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);

    offB();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a double unsubscribe never stops an interval others still need', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onHalfMinuteTick(a);
    const offB = onHalfMinuteTick(b);

    offA();
    offA(); // again - must not tear down b's ticking
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(30000);
    expect(b).toHaveBeenCalledTimes(1);

    offB();
  });

  it('starts a fresh interval when a subscriber arrives after the last left', () => {
    const a = vi.fn();
    onHalfMinuteTick(a)();
    expect(vi.getTimerCount()).toBe(0);

    const b = vi.fn();
    const offB = onHalfMinuteTick(b);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(30000);
    expect(b).toHaveBeenCalledTimes(1);

    offB();
  });

  it('a callback unsubscribing mid-tick does not skip the others', () => {
    const calls = [];
    const offA = onHalfMinuteTick(() => {
      calls.push('a');
      offA();
    });
    const offB = onHalfMinuteTick(() => calls.push('b'));

    vi.advanceTimersByTime(30000);
    expect(calls).toEqual(['a', 'b']);

    offB();
    expect(vi.getTimerCount()).toBe(0);
  });
});
