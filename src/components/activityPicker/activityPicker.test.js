import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActivityPicker } from './activityPicker';
import { KEY_CODE } from './keyboardGridNavigation';
import { TinyBase } from '../base';
import {
  addSpecialDimension,
  SPECIAL_DIMENSION,
  SPECIAL_NAMES,
} from '../../testing/specialCharacters';

class PickerHarness extends TinyBase {}
if (!customElements.get('test-harness-activitypicker')) {
  customElements.define('test-harness-activitypicker', PickerHarness);
}

describe('ActivityPicker', () => {
  beforeEach(() => {
    if (!customElements.get('el-activity-picker')) {
      customElements.define('el-activity-picker', ActivityPicker);
    }
    document.body.innerHTML = '';
  });

  function createPicker() {
    const el = document.createElement('el-activity-picker');
    el.setAttribute('dimensionindex', '0');
    document.body.appendChild(el);
    return el;
  }

  // regression test: connectedCallback used to call this.render() explicitly
  // on top of the render() that TinyBase's own connectedCallback already
  // triggers - since render() ends by calling assignEventHandlers(), which
  // adds a permanent document click listener, every mount registered two
  it('registers exactly one document click listener per mount', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    createPicker();

    const clickListenerCalls = addEventListenerSpy.mock.calls.filter(([type]) => type === 'click');
    expect(clickListenerCalls).toHaveLength(1);
    addEventListenerSpy.mockRestore();
  });

  // regression coverage (#146): a config with HTML special characters in
  // its headings and activity names
  describe('with config text containing HTML special characters', () => {
    let special;
    let onSetActivityOnSelectedEntry;
    beforeEach(() => {
      special = addSpecialDimension();
      onSetActivityOnSelectedEntry = vi.fn();
    });
    afterEach(() => special.remove());

    function createSpecialPicker() {
      const harness = document.createElement('test-harness-activitypicker');
      const key = harness.setProps({ onSetActivityOnSelectedEntry }, true);
      // from markup, as DetailsPanel creates it: the picker reads its
      // Dimension from dimensionindex in its constructor, before any
      // setAttribute call could run
      const template = document.createElement('template');
      template.innerHTML = `<el-activity-picker dimensionindex="${special.index}" key="${key}"></el-activity-picker>`;
      const el = template.content.firstElementChild;
      el.setAttribute('heading', SPECIAL_DIMENSION.description);
      el.setAttribute('instruction', SPECIAL_DIMENSION.instruction);
      document.body.appendChild(el);
      el.hidePopover = vi.fn();
      return el;
    }

    it('shows the heading and instruction as text', () => {
      const el = createSpecialPicker();

      expect(el.querySelector('label').textContent.trim()).toBe(SPECIAL_DIMENSION.description);
      expect(el.querySelector('.instruction').textContent.trim()).toBe(
        SPECIAL_DIMENSION.instruction
      );
    });

    it('stores the exact name of the activity selected', () => {
      const el = createSpecialPicker();

      el.querySelector('[data-activity]').click();

      expect(onSetActivityOnSelectedEntry).toHaveBeenCalledWith(SPECIAL_NAMES[0]);
    });

    it('finds an activity by searching for its special characters', () => {
      const el = createSpecialPicker();

      el.input.value = 'R&R <';
      el.updateResults();

      const results = [...el.popoverElement.querySelectorAll('[data-activity]')];
      expect(results.map((button) => button.dataset.activity)).toEqual(['R&R <rest>']);
    });
  });

  // regression coverage (#145)
  it('renders nothing, not the word "undefined", when it has no heading or instruction', () => {
    const el = createPicker();
    expect(el.textContent).not.toContain('undefined');
  });

  describe('click outside', () => {
    // jsdom has no Popover API, so the popover is reported open by stubbing
    // only that check - the click itself is a real event dispatched on the
    // document, reaching the picker's real listener
    function openPicker() {
      const el = createPicker();
      vi.spyOn(el.popoverElement, 'matches').mockImplementation(
        (selector) => selector === ':popover-open'
      );
      el.hidePopover = vi.fn();
      return el;
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    // regression coverage (#141): the handler read the legacy global
    // window.event instead of taking the event, which Firefox doesn't set
    // for a listener invoked this way - so click-outside never dismissed
    it('hides the popover on a click outside it, using the event it is given', () => {
      const el = openPicker();
      const outside = document.createElement('button');
      document.body.appendChild(outside);
      vi.spyOn(window, 'event', 'get').mockReturnValue(undefined);

      outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(el.hidePopover).toHaveBeenCalledOnce();
    });

    it('keeps the popover open on a click in the input or inside the popover', () => {
      const el = openPicker();

      el.input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      el.popoverElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(el.hidePopover).not.toHaveBeenCalled();
    });

    // regression coverage (#141): the document listener was never removed,
    // so a discarded picker kept reacting to every click on the page
    it('stops listening once the picker is removed', () => {
      const el = openPicker();
      el.remove();

      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(el.hidePopover).not.toHaveBeenCalled();
    });
  });

  // #113: arrow keys walk the popover's visible items; focus stays in the input
  describe('keyboard navigation', () => {
    const press = (el, key) => {
      const evt = new KeyboardEvent('keydown', { keyCode: key, bubbles: true, cancelable: true });
      Object.defineProperty(evt, 'which', { value: key });
      el.input.dispatchEvent(evt);
      return evt;
    };
    const activeId = (el) => el.input.getAttribute('aria-activedescendant');

    it('points aria-activedescendant at the first item on DOWN, and marks it', () => {
      const el = createPicker();
      const first = el.getNavigableItems()[0];

      const evt = press(el, KEY_CODE.DOWN);

      expect(activeId(el)).toBe(first.id);
      expect(first.id).not.toBe('');
      expect(first.classList.contains('kbd-active')).toBe(true);
      expect(evt.defaultPrevented).toBe(true);
    });

    it('moves the mark with the arrow keys, one item at a time', () => {
      const el = createPicker();
      const items = el.getNavigableItems();

      press(el, KEY_CODE.DOWN);
      press(el, KEY_CODE.DOWN);

      expect(activeId(el)).toBe(items[1].id);
      expect(items[0].classList.contains('kbd-active')).toBe(false);
      expect(el.popoverElement.querySelectorAll('.kbd-active')).toHaveLength(1);
    });

    it('walks Category headers and the Activities of open Categories, not collapsed ones', () => {
      const el = createPicker();
      const trigger = el.popoverElement.querySelector('.accordion-trigger');
      const panel = el.querySelector(`[id="${trigger.getAttribute('aria-controls')}"]`);
      const open = el.getNavigableItems().length;

      trigger.click(); // collapse the first Category
      const collapsed = el.getNavigableItems();

      expect(panel.hasAttribute('hidden')).toBe(true);
      expect(collapsed.length).toBeLessThan(open);
      expect(collapsed.some((item) => panel.contains(item))).toBe(false);
      expect(collapsed).toContain(trigger);
    });

    it('selects the active Activity on Enter', () => {
      const el = createPicker();
      el.props = { ...el.props, onSetActivityOnSelectedEntry: vi.fn() };
      el.hidePopover = vi.fn();
      const items = el.getNavigableItems();
      const activityIndex = items.findIndex((item) => item.matches('.activity-button'));

      for (let i = 0; i <= activityIndex; i++) press(el, KEY_CODE.DOWN);
      press(el, KEY_CODE.RETURN);

      expect(el.props.onSetActivityOnSelectedEntry).toHaveBeenCalledWith(
        items[activityIndex].dataset.activity
      );
    });

    it('toggles a Category open or closed on Enter', () => {
      const el = createPicker();
      const trigger = el.popoverElement.querySelector('.accordion-trigger');

      press(el, KEY_CODE.DOWN); // the first item is the first Category header
      press(el, KEY_CODE.RETURN);

      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('clears the active item when the text changes the results', () => {
      const el = createPicker();
      press(el, KEY_CODE.DOWN);

      el.input.value = 'a';
      el.updateResults();

      expect(activeId(el)).toBe('');
      expect(el.gridNavigation.gridFocused).toBe(false);
    });

    it('keeps the active item across a keyup that did not change the text', () => {
      const el = createPicker();
      press(el, KEY_CODE.DOWN);
      const id = activeId(el);

      el.gridNavigation.handleKeyUp({ which: KEY_CODE.SHIFT });

      expect(activeId(el)).toBe(id);
    });

    it('clears the active item when the popover is hidden', () => {
      const el = createPicker();
      el.popoverElement.hidePopover = vi.fn();
      press(el, KEY_CODE.DOWN);

      el.hidePopover();

      expect(activeId(el)).toBe('');
    });
  });

  it('offers a free-text option for an unmatched search when allowFreeText is set', () => {
    const el = createPicker();
    el.allowFreeText = true;
    el.input.value = 'Some new activity';
    el.gridNavigation.handleKeyUp({ which: 0 });

    const freeTextBtn = el.popoverElement.querySelector('[data-free-text]');
    expect(freeTextBtn).not.toBeNull();
    expect(freeTextBtn.textContent).toContain('Some new activity');
  });

  it('does not offer free text when the dimension does not allow it', () => {
    const el = createPicker();
    el.allowFreeText = false;
    el.input.value = 'Some new activity';
    el.gridNavigation.handleKeyUp({ which: 0 });

    expect(el.popoverElement.querySelector('[data-free-text]')).toBeNull();
  });
});
