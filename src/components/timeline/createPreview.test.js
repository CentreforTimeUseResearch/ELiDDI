import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CreatePreview } from './createPreview';
import { X_AXIS, Y_AXIS } from './entryResizeController';

function createContainer() {
  return document.createElementNS('http://www.w3.org/2000/svg', 'g');
}

describe('CreatePreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // day_boundary 04:00: offset 0 is 04:00
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('on the vertical (Y) axis', () => {
    let container;
    let preview;

    beforeEach(() => {
      container = createContainer();
      preview = new CreatePreview({
        container,
        axis: Y_AXIS,
        getPxPerMinute: () => 2,
        crossBox: { start: 100, size: 220 },
      });
    });

    it('draws a block over the span, in the same box an Entry uses', () => {
      preview.show({ startOffsetMins: 60, endOffsetMins: 90, atLimit: false });

      const rect = container.querySelector('[data-part="create-preview"] rect');
      expect(rect.getAttribute('y')).toBe('120');
      expect(rect.getAttribute('height')).toBe('60');
      expect(rect.getAttribute('x')).toBe('100');
      expect(rect.getAttribute('width')).toBe('220');
      expect(rect.classList.contains('create-preview--at-limit')).toBe(false);
    });

    it('states the start and end times as text, centred on the block', () => {
      preview.show({ startOffsetMins: 60, endOffsetMins: 90, atLimit: false });

      const text = container.querySelector('text');
      expect(text.textContent).toBe('05:00–05:30');
      expect(text.getAttribute('y')).toBe('150');
      expect(text.getAttribute('x')).toBe('210');
    });

    it('says "limit" in the text, and styles the block, when a limit cut it short', () => {
      preview.show({ startOffsetMins: 60, endOffsetMins: 80, atLimit: true });

      expect(container.querySelector('text').textContent).toBe('05:00–05:20 · limit');
      expect(container.querySelector('rect').classList.contains('create-preview--at-limit')).toBe(
        true
      );
    });

    it('replaces the block on each update, rather than stacking them', () => {
      preview.show({ startOffsetMins: 60, endOffsetMins: 90, atLimit: false });
      preview.show({ startOffsetMins: 60, endOffsetMins: 100, atLimit: false });

      expect(container.querySelectorAll('rect')).toHaveLength(1);
      expect(container.querySelector('rect').getAttribute('height')).toBe('80');
    });

    it('ignores the pointer and is hidden from assistive technology', () => {
      preview.show({ startOffsetMins: 60, endOffsetMins: 90, atLimit: false });

      const layer = container.querySelector('[data-part="create-preview"]');
      expect(layer.getAttribute('pointer-events')).toBe('none');
      expect(layer.getAttribute('aria-hidden')).toBe('true');
    });

    it('reports whether it is showing, and clears on hide', () => {
      expect(preview.isShowing).toBe(false);

      preview.show({ startOffsetMins: 60, endOffsetMins: 90, atLimit: false });
      expect(preview.isShowing).toBe(true);

      preview.hide();
      expect(preview.isShowing).toBe(false);
      expect(container.querySelector('rect')).toBeNull();
    });

    it('hiding before anything was shown does nothing', () => {
      expect(() => preview.hide()).not.toThrow();
    });

    it('flashes a one-slot "No room here" block, then removes it itself', () => {
      preview.flashNoRoom(60);

      expect(container.querySelector('text').textContent).toBe('No room here');
      expect(container.querySelector('rect').getAttribute('height')).toBe('20');
      expect(container.querySelector('rect').classList.contains('create-preview--at-limit')).toBe(
        true
      );

      vi.advanceTimersByTime(600);

      expect(preview.isShowing).toBe(false);
    });

    it('does not let an earlier flash remove a newer block', () => {
      preview.flashNoRoom(60);
      preview.show({ startOffsetMins: 100, endOffsetMins: 130, atLimit: false });

      vi.advanceTimersByTime(600);

      expect(preview.isShowing).toBe(true);
    });
  });

  describe('on the horizontal (X) axis', () => {
    it('lays the block along x, filling the row', () => {
      const container = createContainer();
      const preview = new CreatePreview({
        container,
        axis: X_AXIS,
        getPxPerMinute: () => 1,
        crossBox: { start: 0, size: 60 },
      });

      preview.show({ startOffsetMins: 60, endOffsetMins: 90, atLimit: false });

      const rect = container.querySelector('rect');
      expect(rect.getAttribute('x')).toBe('60');
      expect(rect.getAttribute('width')).toBe('30');
      expect(rect.getAttribute('y')).toBe('0');
      expect(rect.getAttribute('height')).toBe('60');
      const text = container.querySelector('text');
      expect(text.getAttribute('x')).toBe('75');
      expect(text.getAttribute('y')).toBe('30');
    });
  });
});
