import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installSvgTemplates } from '../../testing/svgTemplates';
import { stubPanelActionsKey } from '../../testing/panelActions';
import { Timeline } from './timeline';
import { HorizontalTimeline } from '../horizontalTimeline/horizontalTimeline';
import { appStore } from '../../store/appStore';
import {
  ADD_TIMELINE,
  ADD_ENTRY,
  SWITCH_DATE,
  HIDE_PANEL,
  SET_HORIZONTAL_ZOOM,
} from '../../store/actionTypes';

// Moving and resizing an Entry from the keyboard: Space picks it up, the
// arrow keys move it, Shift+arrow resizes its end, Alt+Shift+arrow its start,
// Enter confirms and Escape cancels
// (docs/design/flows/keyboard-interaction.md). Both layouts.
const PAST_DATE = '2020-01-01'; // no "now" limit
const LOCATION = 2; // "Location", single-choice
const WHO = 3; // "Who", multiple-choice

const LAYOUTS = [
  {
    name: 'vertical Timeline',
    tag: 'el-timeline',
    Component: Timeline,
    next: 'ArrowDown',
    previous: 'ArrowUp',
    at: (mins) => ({ clientX: 0, clientY: mins * 2 }),
    position: 'y',
    size: 'height',
    pxPerMinute: () => 2,
  },
  {
    name: 'horizontal Timeline',
    tag: 'el-horizontal-timeline',
    Component: HorizontalTimeline,
    next: 'ArrowRight',
    previous: 'ArrowLeft',
    at: (mins, el) => ({ clientX: mins * el.getPxPerMinute(), clientY: 0 }),
    position: 'x',
    size: 'width',
    pxPerMinute: (el) => el.getPxPerMinute(),
  },
];

// A 30-60 (05:30-... clock), B 60-100 (the one moved), C 100-160 touching B, D 200-260 beyond a gap
const A = { id: 1, startOffsetMins: 30, endOffsetMins: 60, activity: 'Reading' };
const B = { id: 2, startOffsetMins: 60, endOffsetMins: 100, activity: 'Walking' };
const C = { id: 3, startOffsetMins: 100, endOffsetMins: 160, activity: 'Eating' };
const D = { id: 4, startOffsetMins: 200, endOffsetMins: 260, activity: 'Sleeping' };

describe.each(LAYOUTS)('keyboard grab - $name', (layout) => {
  let el;

  beforeEach(() => {
    if (!customElements.get(layout.tag)) {
      customElements.define(layout.tag, layout.Component);
    }
    installSvgTemplates();
    document.body.innerHTML = '';
    appStore.dispatch({ type: HIDE_PANEL });
    appStore.dispatch({ type: SET_HORIZONTAL_ZOOM, payload: 1 });
    appStore.dispatch({ type: SWITCH_DATE, payload: PAST_DATE });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    appStore.dispatch({ type: HIDE_PANEL });
  });

  function mount(dimensionIndex = LOCATION, entries = [A, B, C, D]) {
    appStore.dispatch({ type: ADD_TIMELINE, payload: { dimensionIndex, date: PAST_DATE } });
    entries.forEach((entry) =>
      appStore.dispatch({
        type: ADD_ENTRY,
        payload: { dimensionIndex, date: PAST_DATE, ...entry },
      })
    );
    el = document.createElement(layout.tag);
    el.setAttribute('key', stubPanelActionsKey());
    el.setAttribute('index', String(dimensionIndex));
    document.body.appendChild(el);
    el.panelActions.openEntry = vi.fn();
    el.panelActions.openNewEntry = vi.fn();
    el.panelActions.focus = vi.fn();
    return el;
  }

  const stored = (dimensionIndex = LOCATION) =>
    appStore.getState().diaries[PAST_DATE].timelines[dimensionIndex];
  const span = (id, dimensionIndex = LOCATION) => {
    const entry = stored(dimensionIndex).find((entry) => entry.id === id);
    return [entry.startOffsetMins, entry.endOffsetMins];
  };
  const rectOf = (id) => el.querySelector(`[data-part="events"] rect[data-id="${id}"]`);
  const liveSpan = (id) => {
    const rect = rectOf(id);
    const px = layout.pxPerMinute(el);
    const start = Number(rect.getAttribute(layout.position)) / px;
    return [start, start + Number(rect.getAttribute(layout.size)) / px];
  };
  const statusElement = () => document.querySelector('.keyboard-status');
  const status = () => statusElement()?.textContent ?? '';

  function press(key, init = {}) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    document.activeElement.dispatchEvent(event);
    return event;
  }

  // focuses Entry `id` and picks it up
  function grab(id = 2) {
    rectOf(id).focus();
    return press(' ');
  }

  const move = (times = 1, key = layout.next, init = {}) => {
    for (let i = 0; i < times; i++) {
      press(key, init);
    }
  };

  describe('picking up', () => {
    it('is Space on an Entry, and says so as text, with the keys to use', () => {
      mount();

      const event = grab();

      expect(event.defaultPrevented).toBe(true);
      expect(status()).toContain('Grabbed Walking, 05:00 to 05:40.');
      expect(status()).toContain('Enter to confirm');
      expect(status()).toContain('Escape to cancel');
      expect(statusElement().classList.contains('is-active')).toBe(true);
    });

    it('is announced politely, in a status region', () => {
      mount();

      grab();

      expect(statusElement().getAttribute('role')).toBe('status');
      expect(statusElement().getAttribute('aria-live')).toBe('polite');
    });

    it('changes nothing in the store', () => {
      mount();
      const before = stored();

      grab();

      expect(stored()).toBe(before);
    });

    it('is not done by Space on an empty slot, which is left alone', () => {
      mount();
      document.querySelector(layout.tag).querySelector('[tabindex="0"]').focus();

      const event = press(' ');

      expect(event.defaultPrevented).toBe(false);
      expect(statusElement()?.classList.contains('is-active') ?? false).toBe(false);
    });

    it('is not done with modifier keys', () => {
      mount();
      rectOf(2).focus();

      press(' ', { ctrlKey: true });

      expect(statusElement()?.classList.contains('is-active') ?? false).toBe(false);
    });
  });

  describe('moving', () => {
    it('moves the Entry by 10 minutes per arrow key, keeping its duration', () => {
      mount();
      grab();

      press(layout.previous);

      expect(liveSpan(2)).toEqual([50, 90]);
      expect(status()).toContain('Now 04:50 to 05:30.');
    });

    it('shows the move on the block, and the neighbour it trims, without storing anything', () => {
      mount();
      const before = stored();
      grab();

      move(2); // 60-100 -> 80-120: over C's first 20 minutes

      expect(liveSpan(2)).toEqual([80, 120]);
      expect(liveSpan(3)).toEqual([120, 160]);
      expect(stored()).toBe(before);
    });

    it('says what happened to the neighbour', () => {
      mount();
      grab();

      move(2);

      expect(status()).toContain('The next entry now starts at 06:00.');
    });

    it('moves an hour with PageDown and PageUp, to the limit if that is nearer', () => {
      mount(LOCATION, [{ id: 1, startOffsetMins: 300, endOffsetMins: 340, activity: 'Reading' }]);
      grab(1);

      press('PageDown');
      expect(liveSpan(1)).toEqual([360, 400]);
      press('PageUp');
      press('PageUp');
      expect(liveSpan(1)).toEqual([240, 280]);
    });

    it('jumps to the limit with Home and End, and says so', () => {
      mount();
      grab();

      press('End');

      expect(liveSpan(2)).toEqual([110, 150]); // C is left with its last 10 minutes
      expect(status()).toContain('Limit reached');

      press('Home');
      expect(liveSpan(2)).toEqual([40, 80]); // A is left with its first 10 minutes
    });

    it('can be moved back to where it began, with the neighbour restored', () => {
      mount();
      grab();

      move(3);
      move(3, layout.previous);

      expect(liveSpan(2)).toEqual([60, 100]);
      expect(liveSpan(3)).toEqual([100, 160]);
    });

    it('lets Entries overlap on a multiple-choice Dimension', () => {
      mount(WHO, [
        { id: 1, startOffsetMins: 60, endOffsetMins: 100, activity: ['Partner'] },
        { id: 2, startOffsetMins: 100, endOffsetMins: 160, activity: ['Friends'] },
      ]);
      grab(1);

      move(3);
      press('Enter');

      expect(span(1, WHO)).toEqual([90, 130]);
      expect(span(2, WHO)).toEqual([100, 160]);
    });
  });

  describe('resizing', () => {
    it('moves the end edge with Shift and an arrow, and the start with Alt and Shift', () => {
      mount();
      grab();

      press(layout.previous, { shiftKey: true });
      expect(liveSpan(2)).toEqual([60, 90]);
      expect(status()).toContain('Now 05:00 to 05:30.');

      press(layout.next, { shiftKey: true, altKey: true });
      expect(liveSpan(2)).toEqual([70, 90]);
    });

    it('moves the neighbour that shares the edge too', () => {
      mount();
      grab();

      press(layout.next, { shiftKey: true }); // B's end 100 -> 110: C starts at 110

      expect(liveSpan(2)).toEqual([60, 110]);
      expect(liveSpan(3)).toEqual([110, 160]);
    });

    it('lengthens a neighbour when the shared edge is pulled away', () => {
      mount();
      grab();

      press(layout.previous, { shiftKey: true });

      expect(liveSpan(3)).toEqual([90, 160]);
    });

    it('stops where the neighbour would be left with 10 minutes, and says why', () => {
      mount();
      grab();

      press('End', { shiftKey: true });

      expect(liveSpan(2)).toEqual([60, 150]);
      expect(liveSpan(3)).toEqual([150, 160]);
      expect(status()).toContain('Limit reached');
      expect(status()).toContain("can't be shorter than 10 minutes");
    });

    it('keeps the Entry at least 10 minutes long', () => {
      mount();
      grab();

      press('Home', { shiftKey: true });

      expect(liveSpan(2)).toEqual([60, 70]);
      expect(status()).toContain('Limit reached');
    });

    it('resizes by an hour with Shift and PageDown', () => {
      mount(LOCATION, [{ id: 1, startOffsetMins: 300, endOffsetMins: 340, activity: 'Reading' }]);
      grab(1);

      press('PageDown', { shiftKey: true });

      expect(liveSpan(1)).toEqual([300, 400]);
    });
  });

  describe('combining them', () => {
    it('moves and then resizes, each from where the last left it', () => {
      mount();
      grab();

      move(1); // B 70-110, C 110-160
      press(layout.next, { shiftKey: true }); // B end 120, C 120-160
      press('Enter');

      expect(span(2)).toEqual([70, 120]);
      expect(span(3)).toEqual([120, 160]);
    });

    it('puts everything back on Escape, however many kinds of change were made', () => {
      mount();
      const before = stored();
      grab();

      move(2);
      press(layout.next, { shiftKey: true });
      press(layout.previous, { shiftKey: true, altKey: true });
      press('Escape');

      expect(stored()).toBe(before);
      expect(liveSpan(2)).toEqual([60, 100]);
      expect(liveSpan(3)).toEqual([100, 160]);
    });
  });

  describe('confirming', () => {
    it('stores the Entry and the neighbours it trimmed in one change', () => {
      mount();
      const listener = vi.fn();
      grab();
      move(2);
      appStore.subscribe(listener);

      const event = press('Enter');

      expect(event.defaultPrevented).toBe(true);
      expect(span(2)).toEqual([80, 120]);
      expect(span(3)).toEqual([120, 160]);
      expect(span(1)).toEqual([30, 60]);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('is also done with Space', () => {
      mount();
      grab();
      move(1);

      press(' ');

      expect(span(2)).toEqual([70, 110]);
    });

    it('stores nothing until then', () => {
      mount();
      const dispatch = vi.spyOn(appStore, 'dispatch');
      const batch = vi.spyOn(appStore, 'batch');

      grab();
      move(3);
      press(layout.next, { shiftKey: true });

      expect(dispatch).not.toHaveBeenCalled();
      expect(batch).not.toHaveBeenCalled();
    });

    it('says what was done, and leaves the Entry focused at its new place', () => {
      mount();
      grab();
      move(1);

      press('Enter');

      expect(status()).toContain('Done. Walking is now 05:10 to 05:50.');
      expect(statusElement().classList.contains('is-active')).toBe(false);
      expect(document.activeElement).toBe(rectOf(2));
      expect(document.activeElement.getAttribute('aria-label')).toBe(
        'Walking, 05:10 to 05:50, Location'
      );
    });

    it('stores nothing, and says so, when it ends where it began', () => {
      mount();
      const dispatch = vi.spyOn(appStore, 'dispatch');
      const batch = vi.spyOn(appStore, 'batch');
      grab();

      move(2);
      move(2, layout.previous);
      press('Enter');

      expect(dispatch).not.toHaveBeenCalled();
      expect(batch).not.toHaveBeenCalled();
      expect(status()).toContain('No change');
    });
  });

  describe('cancelling', () => {
    it('puts every block back, stores nothing, and says so, on Escape', () => {
      mount();
      const before = stored();
      grab();
      move(2);

      const event = press('Escape');

      expect(event.defaultPrevented).toBe(true);
      expect(stored()).toBe(before);
      expect(liveSpan(2)).toEqual([60, 100]);
      expect(liveSpan(3)).toEqual([100, 160]);
      expect(status()).toContain('Cancelled. Walking is back at 05:00 to 05:40.');
      expect(statusElement().classList.contains('is-active')).toBe(false);
    });

    it('keeps focus on the Entry', () => {
      mount();
      grab();
      move(1);

      press('Escape');

      expect(document.activeElement).toBe(rectOf(2));
    });

    it('cancels when focus leaves the Timeline, without storing anything', () => {
      mount();
      const before = stored();
      grab();
      move(2);
      const outside = document.createElement('button');
      document.body.appendChild(outside);

      outside.focus();

      expect(stored()).toBe(before);
      expect(statusElement().classList.contains('is-active')).toBe(false);
      expect(status()).toContain('Cancelled');
      expect(liveSpan(2)).toEqual([60, 100]);
    });

    it('cancels when the pointer takes over', () => {
      mount();
      const before = stored();
      grab();
      move(2);

      document.dispatchEvent(new Event('pointerdown', { bubbles: true }));

      expect(stored()).toBe(before);
      expect(liveSpan(2)).toEqual([60, 100]);
      expect(statusElement().classList.contains('is-active')).toBe(false);
    });

    it('does not take a key press for Tab away from the browser', () => {
      mount();
      grab();

      const tab = press('Tab');

      expect(tab.defaultPrevented).toBe(false);
    });
  });

  describe('limits', () => {
    it('says when the start of the day stops it', () => {
      mount(LOCATION, [{ id: 1, startOffsetMins: 0, endOffsetMins: 40, activity: 'Reading' }]);
      grab(1);

      press(layout.previous);

      expect(liveSpan(1)).toEqual([0, 40]);
      expect(status()).toContain('Limit reached');
      expect(status()).toContain('start of the day');
    });

    it('says when the end of the day stops it', () => {
      mount(LOCATION, [{ id: 1, startOffsetMins: 1400, endOffsetMins: 1440, activity: 'Reading' }]);
      grab(1);

      press(layout.next);

      expect(status()).toContain('end of the day');
    });

    it('does not say "limit" for a move that is not held back', () => {
      mount();
      grab();

      press(layout.previous);

      expect(status()).not.toContain('Limit reached');
    });
  });

  describe('keys it leaves alone', () => {
    it('ignores other keys and Ctrl or Meta combinations, staying in the mode', () => {
      mount();
      grab();

      const keys = [
        press('x'),
        press('a'),
        press(layout.next, { ctrlKey: true }),
        press(layout.next, { metaKey: true }),
        press(layout.next, { altKey: true }), // Alt alone is the browser's
      ];

      expect(keys.map((event) => event.defaultPrevented)).toEqual([
        false,
        false,
        false,
        false,
        false,
      ]);
      expect(liveSpan(2)).toEqual([60, 100]);
      expect(statusElement().classList.contains('is-active')).toBe(true);
    });
  });

  describe('the focus ring', () => {
    it('follows the Entry as it moves', () => {
      mount();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      grab();

      move(2);

      const ring = el.querySelector('[data-part="focus-ring"] rect');
      expect(Number(ring.getAttribute(layout.position))).toBe(80 * layout.pxPerMinute(el));
      expect(Number(ring.getAttribute(layout.size))).toBe(40 * layout.pxPerMinute(el));
    });
  });

  describe('the status message', () => {
    it('goes away a few seconds after the Entry is confirmed or cancelled', () => {
      mount();
      grab();
      press('Escape');
      expect(status()).not.toBe('');

      vi.advanceTimersByTime(6000);

      expect(status()).toBe('');
    });

    it('is the one element, whichever Timeline is used', () => {
      mount();
      grab();
      press('Escape');
      document.body.innerHTML = '';
      mount();

      grab();

      expect(document.querySelectorAll('.keyboard-status')).toHaveLength(1);
    });
  });

  describe('gives the same result as the pointer', () => {
    const pointer = (id, mins, type, pointerId = 1, pointerType = 'mouse') => {
      const init = { pointerId, pointerType, button: 0, ...layout.at(mins, el) };
      if (type === 'down') {
        el.onEntryPointerDown({ target: rectOf(id), ...init });
      } else if (type === 'move') {
        el.onEntryPointerMove({ target: rectOf(id), ...init });
      } else {
        el.timeLineElement.dispatchEvent(
          Object.assign(new Event('pointerup', { bubbles: true }), init)
        );
      }
    };

    function snapshot() {
      return stored().map((entry) => [entry.id, entry.startOffsetMins, entry.endOffsetMins]);
    }

    it.each([30, -30, 10, 200, -200])('for a move of %i minutes', (delta) => {
      mount();
      pointer(2, 80, 'down');
      pointer(2, 80 + delta, 'move');
      pointer(2, 80 + delta, 'up');
      const byPointer = snapshot();

      document.body.innerHTML = '';
      mount();
      grab();
      const steps = Math.abs(delta) / 10;
      move(Math.min(steps, 30), delta > 0 ? layout.next : layout.previous);
      press('Enter');

      expect(snapshot()).toEqual(byPointer);
    });

    it.each([30, -30, 200, -200])('for the end edge dragged %i minutes', (delta) => {
      mount();
      // long-press to show the handles, then drag the end handle
      pointer(2, 80, 'down', 1, 'touch');
      vi.advanceTimersByTime(500);
      pointer(2, 80, 'up', 1, 'touch');
      const handle = el.querySelector(
        '.resize-handle[data-handle-edge="end"] .resize-handle-hit-area'
      );
      el.onEntryPointerDown({
        target: handle,
        pointerId: 2,
        pointerType: 'touch',
        ...layout.at(100, el),
      });
      el.onEntryPointerMove({ target: handle, pointerId: 2, ...layout.at(100 + delta, el) });
      el.timeLineElement.dispatchEvent(
        Object.assign(new Event('pointerup', { bubbles: true }), {
          pointerId: 2,
          ...layout.at(100 + delta, el),
        })
      );
      const byPointer = snapshot();

      document.body.innerHTML = '';
      mount();
      grab();
      const steps = Math.abs(delta) / 10;
      move(Math.min(steps, 30), delta > 0 ? layout.next : layout.previous, { shiftKey: true });
      press('Enter');

      expect(snapshot()).toEqual(byPointer);
    });
  });
});
