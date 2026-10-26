import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installSvgTemplates } from '../../testing/svgTemplates';
import './timelineStack';
import { moveToNewParent, errorsDuring } from '../../testing/domMoves';
import { appStore } from '../../store/appStore';
import { SWITCH_DIMENSION } from '../../store/actionTypes';

describe('TimelineStack scroll-snap Dimension switching', () => {
  beforeEach(() => {
    installSvgTemplates();
    document.body.innerHTML = '';
    appStore.dispatch({ type: SWITCH_DIMENSION, payload: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createStack() {
    const stack = document.createElement('el-timeline-stack');
    document.body.appendChild(stack);
    return stack;
  }

  // regression coverage (#163): render() appended a full set of Timelines
  // on every connection, so a moved stack had twelve
  it('keeps one Timeline per Dimension when moved', () => {
    const stack = createStack();
    const timelines = [...stack.children];

    const errors = errorsDuring(() => moveToNewParent(stack));

    expect(errors).toEqual([]);
    expect([...stack.children]).toEqual(timelines);
  });

  // snapTargetInline can't be set through the Event constructor, so it's
  // attached to a plain Event the way a browser exposes it. The event fires
  // on the strip that scrolls, inside the stack (#151)
  function snapTo(stack, target) {
    const event = new Event('scrollsnapchange');
    event.snapTargetInline = target;
    stack.querySelector('.timeline-scroller').dispatchEvent(event);
  }

  const timelinesOf = (stack) => [...stack.querySelectorAll('el-timeline')];

  // #118: no scrollsnapchange (jsdom, like Firefox/Safari, lacks it), so the
  // settled scroll position decides
  describe('scroll fallback without scrollsnapchange', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    function scrollTo(stack, scrollLeft) {
      const scroller = stack.querySelector('.timeline-scroller');
      Object.defineProperty(scroller, 'scrollWidth', { value: 600, configurable: true });
      scroller.scrollLeft = scrollLeft;
      scroller.dispatchEvent(new Event('scroll'));
    }

    it('switches to the Timeline the strip settled on, once scrolling pauses', () => {
      const stack = createStack();

      scrollTo(stack, 205); // 100px per Timeline -> index 2
      expect(appStore.getState().currentDimensionIndex).toBe(0);
      vi.advanceTimersByTime(100);

      expect(appStore.getState().currentDimensionIndex).toBe(2);
    });

    it('waits for the last scroll event of a swipe', () => {
      const stack = createStack();

      scrollTo(stack, 100);
      vi.advanceTimersByTime(60);
      scrollTo(stack, 300);
      vi.advanceTimersByTime(60);
      expect(appStore.getState().currentDimensionIndex).toBe(0);
      vi.advanceTimersByTime(40);

      expect(appStore.getState().currentDimensionIndex).toBe(3);
    });

    it('does not use the fallback where scrollsnapchange exists', () => {
      window.onscrollsnapchange = null;
      try {
        const stack = createStack();
        scrollTo(stack, 300);
        vi.advanceTimersByTime(200);

        expect(appStore.getState().currentDimensionIndex).toBe(0);
      } finally {
        delete window.onscrollsnapchange;
      }
    });
  });

  it('switches to the Dimension of the timeline it snapped to', () => {
    const stack = createStack();

    snapTo(stack, timelinesOf(stack)[3]);

    expect(appStore.getState().currentDimensionIndex).toBe(3);
  });

  // hardening (#144): the index used to be read as snapTargetInline.index,
  // a property that only exists because Timeline's attributeChangedCallback
  // happens to mirror its `index` attribute onto the instance - any other
  // snap target gave Number(undefined) -> NaN, dispatched as the current
  // Dimension
  it.each([
    ['an element with no index attribute', () => document.createElement('div')],
    ['no snap target at all', () => null],
  ])('dispatches nothing when snapping to %s', (_, makeTarget) => {
    const stack = createStack();
    const dispatch = vi.spyOn(appStore, 'dispatch');
    vi.spyOn(console, 'error').mockImplementation(() => {});

    snapTo(stack, makeTarget());

    expect(dispatch).not.toHaveBeenCalled();
    expect(appStore.getState().currentDimensionIndex).toBe(0);
  });
});
