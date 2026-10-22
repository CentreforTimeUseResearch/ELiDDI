import { describe, it, expect, vi } from 'vitest';
import { watchDesktopBreakpoint } from './breakpoint';

function createFakeMatchMedia(initialMatches) {
  let listener;
  const mediaQueryList = {
    matches: initialMatches,
    addEventListener: vi.fn((type, cb) => {
      listener = cb;
    }),
    removeEventListener: vi.fn(),
  };
  const matchMediaFn = vi.fn(() => mediaQueryList);
  return { matchMediaFn, mediaQueryList, fireChange: (matches) => listener({ matches }) };
}

describe('watchDesktopBreakpoint', () => {
  it('calls onChange(false) immediately and returns a no-op cleanup when matchMedia is unavailable', () => {
    const onChange = vi.fn();

    const cleanup = watchDesktopBreakpoint(onChange, undefined);

    expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(() => cleanup()).not.toThrow();
  });

  it('calls onChange with the current match state immediately on attach', () => {
    const onChange = vi.fn();
    const { matchMediaFn } = createFakeMatchMedia(true);

    watchDesktopBreakpoint(onChange, matchMediaFn);

    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(matchMediaFn).toHaveBeenCalledWith('(min-width: 1024px)');
  });

  it('calls onChange again whenever the media query crosses', () => {
    const onChange = vi.fn();
    const { matchMediaFn, fireChange } = createFakeMatchMedia(false);

    watchDesktopBreakpoint(onChange, matchMediaFn);
    fireChange(true);
    fireChange(false);

    expect(onChange).toHaveBeenNthCalledWith(1, false);
    expect(onChange).toHaveBeenNthCalledWith(2, true);
    expect(onChange).toHaveBeenNthCalledWith(3, false);
  });

  it('removes the change listener when the returned cleanup is called', () => {
    const onChange = vi.fn();
    const { matchMediaFn, mediaQueryList } = createFakeMatchMedia(false);

    const cleanup = watchDesktopBreakpoint(onChange, matchMediaFn);
    cleanup();

    expect(mediaQueryList.removeEventListener).toHaveBeenCalledWith(
      'change',
      mediaQueryList.addEventListener.mock.calls[0][1]
    );
  });
});
