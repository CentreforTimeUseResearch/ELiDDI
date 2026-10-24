import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActivityPicker } from './activityPicker';
import { KEY_CODE } from './keyboardGridNavigation';

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

  // regression test: the arrow-key branch used to set aria-activedescendant
  // via a `selectedItem` variable that was never declared, throwing a
  // ReferenceError as soon as this branch became reachable (rowsCount >= 1)
  it('handles an arrow key without throwing once rowsCount is populated', () => {
    const el = createPicker();
    el.gridNavigation.rowsCount = 1;
    const fakeEvent = {
      keyCode: KEY_CODE.DOWN,
      which: KEY_CODE.DOWN,
      preventDefault: () => {},
    };

    expect(() => el.gridNavigation.handleKeyDown(fakeEvent)).not.toThrow();
    expect(el.input.getAttribute('aria-activedescendant')).toBe('');
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
