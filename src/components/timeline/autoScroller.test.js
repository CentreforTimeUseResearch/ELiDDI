import { describe, it, expect, vi } from 'vitest';
import {
  AutoScroller,
  edgeScrollSpeed,
  EDGE_ZONE_PX,
  MAX_SPEED_PX_PER_SEC,
  DWELL_MS,
} from './autoScroller';

describe('edgeScrollSpeed', () => {
  it('is 0 away from the edges', () => {
    expect(edgeScrollSpeed(500, 0, 1000)).toBe(0);
  });
  it('scrolls towards the end near the right edge, faster the closer', () => {
    const near = edgeScrollSpeed(1000 - EDGE_ZONE_PX / 2, 0, 1000);
    expect(near).toBeGreaterThan(0);
    expect(edgeScrollSpeed(1000, 0, 1000)).toBe(MAX_SPEED_PX_PER_SEC);
    expect(edgeScrollSpeed(1200, 0, 1000)).toBe(MAX_SPEED_PX_PER_SEC);
    expect(near).toBeLessThan(MAX_SPEED_PX_PER_SEC);
  });
  it('scrolls towards the start near the left edge', () => {
    expect(edgeScrollSpeed(10, 0, 1000)).toBeLessThan(0);
    expect(edgeScrollSpeed(-50, 0, 1000)).toBe(-MAX_SPEED_PX_PER_SEC);
  });
});

describe('AutoScroller', () => {
  function setup({ clientX, insets } = {}) {
    let time = 0;
    let pending;
    // like a browser: changing scrollLeft fires a scroll event
    const scroller = new EventTarget();
    let left = 100;
    Object.defineProperty(scroller, 'scrollLeft', {
      get: () => left,
      set: (value) => {
        if (value !== left) {
          left = value;
          scroller.dispatchEvent(new Event('scroll'));
        }
      },
    });
    scroller.getBoundingClientRect = () => ({ left: 0, right: 1000 });
    const onScrolled = vi.fn();
    const auto = new AutoScroller({
      getScroller: () => scroller,
      getInsets: () => insets ?? { left: 0, right: 0 },
      onScrolled,
      raf: (cb) => {
        pending = cb;
        return 1;
      },
      caf: () => {
        pending = undefined;
      },
      now: () => time,
      prefersReducedMotion: () => false,
    });
    const advance = (ms) => {
      time += ms;
      const cb = pending;
      pending = undefined;
      cb?.();
    };
    auto.start(clientX ?? 500);
    return { auto, scroller, onScrolled, advance, isPending: () => Boolean(pending) };
  }

  it('does not scroll when the pointer is mid-container', () => {
    const { scroller, advance } = setup({ clientX: 500 });
    advance(16);
    advance(DWELL_MS + 16);
    expect(scroller.scrollLeft).toBe(100);
  });

  it('waits for the dwell, then scrolls and reports each step', () => {
    const { scroller, onScrolled, advance } = setup({ clientX: 1000 });
    advance(16);
    expect(scroller.scrollLeft).toBe(100);
    advance(DWELL_MS);
    expect(scroller.scrollLeft).toBeGreaterThan(100);
    expect(onScrolled).toHaveBeenCalled();
  });

  it('scrolls back towards the start at the left edge', () => {
    const { scroller, advance } = setup({ clientX: 0 });
    advance(16);
    advance(DWELL_MS);
    expect(scroller.scrollLeft).toBeLessThan(100);
  });

  it('treats the sticky gutter as part of the left edge', () => {
    const { scroller, advance } = setup({ clientX: 200, insets: { left: 168, right: 0 } });
    advance(16);
    advance(DWELL_MS);
    expect(scroller.scrollLeft).toBeLessThan(100);
  });

  it('restarts the dwell after leaving the zone and follows update()', () => {
    const { auto, scroller, advance } = setup({ clientX: 1000 });
    advance(16);
    auto.update(500);
    advance(DWELL_MS);
    expect(scroller.scrollLeft).toBe(100);
  });

  it('reports a scroll the user made (wheel, trackpad) during the drag, and only until stop()', () => {
    const { auto, scroller, onScrolled } = setup({ clientX: 500 });
    scroller.scrollLeft = 400;
    expect(onScrolled).toHaveBeenCalledTimes(1);
    auto.stop();
    scroller.dispatchEvent(new Event('scroll'));
    expect(onScrolled).toHaveBeenCalledTimes(1);
  });

  it('reports each edge-scroll step exactly once', () => {
    const { onScrolled, advance } = setup({ clientX: 1000 });
    advance(16);
    advance(DWELL_MS);
    expect(onScrolled).toHaveBeenCalledTimes(1);
  });

  it('stops its loop on stop()', () => {
    const { auto, isPending } = setup();
    expect(isPending()).toBe(true);
    auto.stop();
    expect(isPending()).toBe(false);
    expect(auto.running).toBe(false);
  });

  it('does nothing when there is no scroller', () => {
    const auto = new AutoScroller({ getScroller: () => undefined, onScrolled: vi.fn() });
    auto.start(0);
    expect(auto.running).toBe(false);
  });
});
