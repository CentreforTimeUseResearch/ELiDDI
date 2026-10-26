import { describe, it, expect, vi } from 'vitest';
import { KeyboardGridNavigation, KEY_CODE } from './keyboardGridNavigation';

function createHost(items = []) {
  return {
    updateResults: vi.fn(),
    getItems: vi.fn(() => items),
    setActiveItem: vi.fn(),
    activateItem: vi.fn(),
    clearInputDeferred: vi.fn(),
    hideResults: vi.fn(),
  };
}

function fakeEvent(keyCode) {
  return { which: keyCode, keyCode, preventDefault: vi.fn() };
}

describe('KeyboardGridNavigation.handleKeyUp', () => {
  it('triggers a results update for a plain typing key', () => {
    const host = createHost();
    const nav = new KeyboardGridNavigation(host);

    nav.handleKeyUp(fakeEvent(65)); // 'A'

    expect(host.updateResults).toHaveBeenCalledOnce();
  });

  it('prevents default and does not search on navigation keys', () => {
    const host = createHost();
    const nav = new KeyboardGridNavigation(host);
    const evt = fakeEvent(KEY_CODE.DOWN);

    nav.handleKeyUp(evt);

    expect(evt.preventDefault).toHaveBeenCalledOnce();
    expect(host.updateResults).not.toHaveBeenCalled();
  });
});

describe('KeyboardGridNavigation.handleKeyDown', () => {
  it('defers clearing the input on Escape when not grid-focused and results are not shown', () => {
    const host = createHost();
    const nav = new KeyboardGridNavigation(host);

    nav.handleKeyDown(fakeEvent(KEY_CODE.ESC));

    expect(host.clearInputDeferred).toHaveBeenCalledOnce();
  });

  const ITEMS = ['a', 'b', 'c'];
  const press = (nav, key) => {
    const evt = fakeEvent(key);
    nav.handleKeyDown(evt);
    return evt;
  };

  it('does nothing while there are no items', () => {
    const host = createHost([]);
    const nav = new KeyboardGridNavigation(host);

    const evt = press(nav, KEY_CODE.DOWN);

    expect(nav.gridFocused).toBe(false);
    expect(evt.preventDefault).not.toHaveBeenCalled();
    expect(host.setActiveItem).not.toHaveBeenCalled();
  });

  it('moves into the first item on DOWN', () => {
    const host = createHost(ITEMS);
    const nav = new KeyboardGridNavigation(host);

    const evt = press(nav, KEY_CODE.DOWN);

    expect(nav.gridFocused).toBe(true);
    expect(nav.activeRowIndex).toBe(0);
    expect(host.setActiveItem).toHaveBeenLastCalledWith('a');
    expect(evt.preventDefault).toHaveBeenCalled();
  });

  it('moves down through the items and wraps from the last to the first', () => {
    const host = createHost(ITEMS);
    const nav = new KeyboardGridNavigation(host);

    [KEY_CODE.DOWN, KEY_CODE.DOWN, KEY_CODE.DOWN].forEach((key) => press(nav, key));
    expect(host.setActiveItem).toHaveBeenLastCalledWith('c');

    press(nav, KEY_CODE.DOWN);
    expect(host.setActiveItem).toHaveBeenLastCalledWith('a');
  });

  it('moves to the last item on UP from the input', () => {
    const host = createHost(ITEMS);
    const nav = new KeyboardGridNavigation(host);

    press(nav, KEY_CODE.UP);

    expect(host.setActiveItem).toHaveBeenLastCalledWith('c');
  });

  it('moves up through the items, and from the first back to the input', () => {
    const host = createHost(ITEMS);
    const nav = new KeyboardGridNavigation(host);
    press(nav, KEY_CODE.DOWN);
    press(nav, KEY_CODE.DOWN);

    press(nav, KEY_CODE.UP);
    expect(host.setActiveItem).toHaveBeenLastCalledWith('a');

    press(nav, KEY_CODE.UP);
    expect(nav.gridFocused).toBe(false);
    expect(nav.activeRowIndex).toBe(-1);
    expect(host.setActiveItem).toHaveBeenLastCalledWith(null);
  });

  it('jumps to the first and last item with HOME and END once in the list', () => {
    const host = createHost(ITEMS);
    const nav = new KeyboardGridNavigation(host);
    press(nav, KEY_CODE.DOWN);

    press(nav, KEY_CODE.END);
    expect(host.setActiveItem).toHaveBeenLastCalledWith('c');
    press(nav, KEY_CODE.HOME);
    expect(host.setActiveItem).toHaveBeenLastCalledWith('a');
  });

  it("leaves HOME and END to the input's caret while still typing", () => {
    const host = createHost(ITEMS);
    const nav = new KeyboardGridNavigation(host);

    const evt = press(nav, KEY_CODE.END);

    expect(evt.preventDefault).not.toHaveBeenCalled();
    expect(host.setActiveItem).not.toHaveBeenCalled();
  });

  it('clamps to the items there are now when the list has shrunk', () => {
    const items = ['a', 'b', 'c'];
    const host = createHost(items);
    const nav = new KeyboardGridNavigation(host);
    press(nav, KEY_CODE.DOWN);
    press(nav, KEY_CODE.END);
    items.length = 1;

    press(nav, KEY_CODE.UP);

    expect(nav.activeRowIndex).toBe(0);
  });

  it('activates the active item on Return', () => {
    const host = createHost(ITEMS);
    const nav = new KeyboardGridNavigation(host);
    press(nav, KEY_CODE.DOWN);
    press(nav, KEY_CODE.DOWN);

    const evt = press(nav, KEY_CODE.RETURN);

    expect(host.activateItem).toHaveBeenCalledWith('b');
    expect(evt.preventDefault).toHaveBeenCalled();
  });

  it('leaves Return alone while no item is active', () => {
    const host = createHost(ITEMS);
    const nav = new KeyboardGridNavigation(host);

    const evt = press(nav, KEY_CODE.RETURN);

    expect(host.activateItem).not.toHaveBeenCalled();
    expect(evt.preventDefault).not.toHaveBeenCalled();
  });

  it('exits the list and clears the active item on Escape while in it', () => {
    const host = createHost(ITEMS);
    const nav = new KeyboardGridNavigation(host);
    press(nav, KEY_CODE.DOWN);

    press(nav, KEY_CODE.ESC);

    expect(nav.gridFocused).toBe(false);
    expect(nav.activeRowIndex).toBe(-1);
    expect(host.setActiveItem).toHaveBeenLastCalledWith(null);
    expect(host.clearInputDeferred).not.toHaveBeenCalled();
  });

  it('does not search on keyup for HOME and END while in the list', () => {
    const host = createHost(ITEMS);
    const nav = new KeyboardGridNavigation(host);
    press(nav, KEY_CODE.DOWN);

    nav.handleKeyUp(fakeEvent(KEY_CODE.END));

    expect(host.updateResults).not.toHaveBeenCalled();
  });
});
