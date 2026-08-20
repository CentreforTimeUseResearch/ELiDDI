import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActivityPicker } from './activityPicker';
import { KEY_CODE } from './keyboardGridNavigation';

describe('ActivityPicker', () => {
  beforeEach(() => {
    if (!customElements.get('el-activitypicker')) {
      customElements.define('el-activitypicker', ActivityPicker);
    }
    document.body.innerHTML = '';
  });

  function createPicker() {
    const el = document.createElement('el-activitypicker');
    // render() reads the dimension index via this[ID] (ID = 'id'), which
    // resolves to the native DOM `id` property - in real usage this is
    // always set because the markup is parsed with an id="..." attribute
    // already present (see DetailsPanel's render()), so match that here
    el.setAttribute('id', '0');
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
