import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EntryCreateController } from './entryCreateController';

const PAST_DATE = '2020-01-01'; // no "now" limit on a past day

// 2 px per minute, like the vertical Timeline: the pointer's y is the SVG coordinate
const slotOf = (coord) => Math.floor(coord / 20) * 10;
const y = (mins) => mins * 2;

const entry = (startOffsetMins, endOffsetMins) => ({
  id: startOffsetMins,
  startOffsetMins,
  endOffsetMins,
});

describe('EntryCreateController', () => {
  let svg;
  let preview;
  let onCreate;
  let entries;
  let singleChoice;
  let controller;
  let zone;

  beforeEach(() => {
    vi.useFakeTimers();
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    preview = { show: vi.fn(), hide: vi.fn() };
    onCreate = vi.fn();
    entries = [];
    singleChoice = true;
    zone = { dataset: { part: 'gridline-zone' }, setPointerCapture: vi.fn() };
    controller = new EntryCreateController({
      svg,
      preview,
      getEntries: () => entries,
      isSingleChoiceDimension: () => singleChoice,
      getCurrentDate: () => PAST_DATE,
      clientToSvgCoord: (clientX, clientY) => clientY,
      calculateTheTimeSlotClicked: slotOf,
      onCreate,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const pointer = (mins, overrides = {}) => ({
    target: zone,
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    clientX: 0,
    clientY: y(mins),
    preventDefault: vi.fn(),
    ...overrides,
  });

  describe('with a mouse', () => {
    it('paints a block from the pressed slot to the slot under the pointer, and creates it on release', () => {
      controller.onPointerDown(pointer(60));
      controller.onPointerMove(pointer(90));

      expect(preview.show).toHaveBeenLastCalledWith({
        startOffsetMins: 60,
        endOffsetMins: 100,
        atLimit: false,
      });

      controller.handlePointerUp(pointer(90));

      expect(onCreate).toHaveBeenCalledOnce();
      expect(onCreate).toHaveBeenCalledWith({
        startOffsetMins: 60,
        endOffsetMins: 100,
        atLimit: false,
      });
    });

    it('follows the pointer in both directions', () => {
      controller.onPointerDown(pointer(90));
      controller.onPointerMove(pointer(60));
      controller.handlePointerUp(pointer(60));

      expect(onCreate).toHaveBeenCalledWith({
        startOffsetMins: 60,
        endOffsetMins: 100,
        atLimit: false,
      });
    });

    it('swallows the click that ends a drag, once', () => {
      controller.onPointerDown(pointer(60));
      controller.onPointerMove(pointer(90));
      controller.handlePointerUp(pointer(90));

      expect(controller.consumeSuppressedClick()).toBe(true);
      expect(controller.consumeSuppressedClick()).toBe(false);
    });

    it('forgets an unconsumed click suppression, so it cannot swallow a later click', () => {
      controller.onPointerDown(pointer(60));
      controller.onPointerMove(pointer(90));
      controller.handlePointerUp(pointer(90));

      vi.runAllTimers();

      expect(controller.consumeSuppressedClick()).toBe(false);
    });

    it('leaves a press that stays in its slot to the click handler', () => {
      controller.onPointerDown(pointer(60));
      controller.onPointerMove(pointer(65)); // still slot 60
      controller.handlePointerUp(pointer(65));

      expect(onCreate).not.toHaveBeenCalled();
      expect(preview.show).not.toHaveBeenCalled();
      expect(controller.consumeSuppressedClick()).toBe(false);
    });

    it('takes pointer capture only once a drag begins, so a plain click still lands on its target', () => {
      controller.onPointerDown(pointer(60));
      expect(zone.setPointerCapture).not.toHaveBeenCalled();

      controller.onPointerMove(pointer(90));

      expect(zone.setPointerCapture).toHaveBeenCalledWith(1);
    });

    it('keeps the SVG from panning (touch-action) for the drag only', () => {
      controller.onPointerDown(pointer(60));
      controller.onPointerMove(pointer(90));
      expect(svg.classList.contains('dragging-handle')).toBe(true);

      controller.handlePointerUp(pointer(90));

      expect(svg.classList.contains('dragging-handle')).toBe(false);
    });

    it('stops at the next Entry and reports the limit', () => {
      entries = [entry(100, 140)];

      controller.onPointerDown(pointer(60));
      controller.onPointerMove(pointer(200));
      controller.handlePointerUp(pointer(200));

      expect(onCreate).toHaveBeenCalledWith({
        startOffsetMins: 60,
        endOffsetMins: 100,
        atLimit: true,
      });
    });

    it('may overlap neighbours on a multiple-choice Dimension', () => {
      singleChoice = false;
      entries = [entry(100, 140)];

      controller.onPointerDown(pointer(60));
      controller.onPointerMove(pointer(200));
      controller.handlePointerUp(pointer(200));

      expect(onCreate).toHaveBeenCalledWith({
        startOffsetMins: 60,
        endOffsetMins: 210,
        atLimit: false,
      });
    });

    it('creates nothing, and hides the block, if the press began on a covered slot', () => {
      entries = [entry(60, 120)];

      controller.onPointerDown(pointer(80));
      controller.onPointerMove(pointer(150));
      controller.handlePointerUp(pointer(150));

      expect(onCreate).not.toHaveBeenCalled();
      expect(preview.show).not.toHaveBeenCalled();
      expect(preview.hide).toHaveBeenCalled();
    });

    it('ignores presses that are not on empty time', () => {
      const onEntry = { dataset: { id: '4' } };

      controller.onPointerDown(pointer(60, { target: onEntry }));
      controller.onPointerMove(pointer(90, { target: onEntry }));
      controller.handlePointerUp(pointer(90, { target: onEntry }));

      expect(onCreate).not.toHaveBeenCalled();
      expect(preview.show).not.toHaveBeenCalled();
    });

    it('ignores a non-primary mouse button', () => {
      controller.onPointerDown(pointer(60, { button: 2 }));
      controller.onPointerMove(pointer(90));
      controller.handlePointerUp(pointer(90));

      expect(onCreate).not.toHaveBeenCalled();
    });

    it('ignores a different pointer mid-drag', () => {
      controller.onPointerDown(pointer(60));
      controller.onPointerMove(pointer(90));

      controller.onPointerMove(pointer(150, { pointerId: 2 }));
      controller.handlePointerUp(pointer(150, { pointerId: 2 }));

      expect(onCreate).not.toHaveBeenCalled();
      expect(preview.show).toHaveBeenLastCalledWith(
        expect.objectContaining({ endOffsetMins: 100 })
      );
    });
  });

  describe('cancelling', () => {
    it('creates nothing on pointercancel, and hides the block', () => {
      controller.onPointerDown(pointer(60));
      controller.onPointerMove(pointer(90));

      controller.handlePointerCancel(pointer(90));

      expect(onCreate).not.toHaveBeenCalled();
      expect(preview.hide).toHaveBeenCalled();
      expect(svg.classList.contains('dragging-handle')).toBe(false);
    });

    it('creates nothing on Escape, and hides the block', () => {
      controller.onPointerDown(pointer(60));
      controller.onPointerMove(pointer(90));

      controller.handleGlobalKeyDown({ key: 'Escape' });

      expect(onCreate).not.toHaveBeenCalled();
      expect(preview.hide).toHaveBeenCalled();
    });

    it('stays cancelled when the pointer moves on after Escape, and swallows the click on release', () => {
      controller.onPointerDown(pointer(60));
      controller.onPointerMove(pointer(90));
      controller.handleGlobalKeyDown({ key: 'Escape' });
      preview.show.mockClear();

      controller.onPointerMove(pointer(150));
      controller.handlePointerUp(pointer(150));

      expect(preview.show).not.toHaveBeenCalled();
      expect(onCreate).not.toHaveBeenCalled();
      expect(controller.consumeSuppressedClick()).toBe(true);
    });

    it('ignores other keys', () => {
      controller.onPointerDown(pointer(60));
      controller.onPointerMove(pointer(90));

      controller.handleGlobalKeyDown({ key: 'a' });
      controller.handlePointerUp(pointer(90));

      expect(onCreate).toHaveBeenCalledOnce();
    });

    it('abandons everything when destroyed', () => {
      controller.onPointerDown(pointer(60));
      controller.onPointerMove(pointer(90));

      controller.destroy();
      controller.handlePointerUp(pointer(90));

      expect(onCreate).not.toHaveBeenCalled();
      expect(preview.hide).toHaveBeenCalled();
    });
  });

  describe('with a touch', () => {
    const touch = (mins, overrides = {}) => pointer(mins, { pointerType: 'touch', ...overrides });

    it('does not paint, and does not stop a scroll, when the finger moves before resting long enough', () => {
      controller.onPointerDown(touch(60));
      const scroll = { preventDefault: vi.fn() };

      controller.onPointerMove(touch(90, { clientY: y(60) + 40 })); // 40px: a scroll
      controller.handleTouchMove(scroll);
      controller.handlePointerUp(touch(90));

      expect(onCreate).not.toHaveBeenCalled();
      expect(preview.show).not.toHaveBeenCalled();
      expect(scroll.preventDefault).not.toHaveBeenCalled();
    });

    it('paints once the finger has rested long enough, and then keeps the page from scrolling', () => {
      controller.onPointerDown(touch(60));
      vi.advanceTimersByTime(150);
      const move = { preventDefault: vi.fn() };

      controller.handleTouchMove(move);
      expect(move.preventDefault).toHaveBeenCalled(); // armed, even before it moves

      controller.onPointerMove(touch(90));
      controller.handlePointerUp(touch(90));

      expect(onCreate).toHaveBeenCalledWith({
        startOffsetMins: 60,
        endOffsetMins: 100,
        atLimit: false,
      });
    });

    it('tolerates a few pixels of finger wobble while resting', () => {
      controller.onPointerDown(touch(60));

      controller.onPointerMove(touch(60, { clientY: y(60) + 4 }));
      vi.advanceTimersByTime(150);
      controller.onPointerMove(touch(90));
      controller.handlePointerUp(touch(90));

      expect(onCreate).toHaveBeenCalledOnce();
    });

    it('leaves a quick tap to the click handler', () => {
      controller.onPointerDown(touch(60));
      controller.handlePointerUp(touch(60));
      vi.advanceTimersByTime(500);

      expect(onCreate).not.toHaveBeenCalled();
      expect(controller.consumeSuppressedClick()).toBe(false);
    });
  });
});
