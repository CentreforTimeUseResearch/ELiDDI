import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActivityPicker } from './activityPicker';

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
    el.rowsCount = 1;
    const fakeEvent = {
      keyCode: el.keyCode.DOWN,
      which: el.keyCode.DOWN,
      preventDefault: () => {},
    };

    expect(() => el.handleInputKeyDown(fakeEvent)).not.toThrow();
    expect(el.input.getAttribute('aria-activedescendant')).toBe('');
  });
});
