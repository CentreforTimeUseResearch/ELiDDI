import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './timelineStack';
// deliberately NOT importing DetailsPanel (unlike timeline.test.js): this
// suite is only about scroll-snap, and leaving <el-details-panel>
// unregistered keeps it inert. Six registered panels would render six
// DurationInputs sharing the same element ids, which jsdom's scoped
// #id lookup can't resolve past the first copy
import { appStore } from '../../store/appStore';
import { SWITCH_DIMENSION } from '../../store/actionTypes';

describe('TimelineStack scroll-snap Dimension switching', () => {
  beforeEach(() => {
    if (!document.getElementById('svg-timeline')) {
      const template = document.createElement('template');
      template.id = 'svg-timeline';
      template.innerHTML = `
        <svg>
          <g id="timeline-shadow"></g>
          <rect id="future-overlay"></rect>
          <g id="events"></g>
        </svg>
      `;
      document.head.appendChild(template);
    }
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

  // snapTargetInline can't be set through the Event constructor, so it's
  // attached to a plain Event the way a browser exposes it
  function snapTo(stack, target) {
    const event = new Event('scrollsnapchange');
    event.snapTargetInline = target;
    stack.dispatchEvent(event);
  }

  it('switches to the Dimension of the timeline it snapped to', () => {
    const stack = createStack();

    snapTo(stack, stack.children[3]);

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
