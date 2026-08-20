import { describe, it, expect, vi } from 'vitest';
import { KeyboardGridNavigation, KEY_CODE } from './keyboardGridNavigation';

function createHost() {
  return {
    updateResults: vi.fn(),
    setActiveDescendant: vi.fn(),
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

  // regression test: this used to throw a ReferenceError (an undeclared
  // `selectedItem`) as soon as it became reachable - rowsCount is never
  // populated by ActivityPicker today, so this only ever ran in this test
  it('does nothing beyond returning while rowsCount is 0 (grid not populated)', () => {
    const host = createHost();
    const nav = new KeyboardGridNavigation(host);

    nav.handleKeyDown(fakeEvent(KEY_CODE.DOWN));

    expect(nav.gridFocused).toBe(false);
    expect(host.setActiveDescendant).not.toHaveBeenCalled();
  });

  it('moves focus into the grid and clears aria-activedescendant once rowsCount is populated', () => {
    const host = createHost();
    const nav = new KeyboardGridNavigation(host);
    nav.rowsCount = 3;

    nav.handleKeyDown(fakeEvent(KEY_CODE.DOWN));

    expect(nav.gridFocused).toBe(true);
    expect(host.setActiveDescendant).toHaveBeenCalledWith('');
  });

  it('wraps column navigation with LEFT/RIGHT', () => {
    const host = createHost();
    const nav = new KeyboardGridNavigation(host);
    nav.rowsCount = 1;
    nav.colsCount = 3;

    nav.handleKeyDown(fakeEvent(KEY_CODE.LEFT));
    expect(nav.activeColIndex).toBe(2);

    nav.handleKeyDown(fakeEvent(KEY_CODE.RIGHT));
    expect(nav.activeColIndex).toBe(0);
  });

  it('exits grid focus on Return', () => {
    const host = createHost();
    const nav = new KeyboardGridNavigation(host);
    nav.rowsCount = 1;
    nav.gridFocused = true;

    nav.handleKeyDown(fakeEvent(KEY_CODE.RETURN));

    expect(nav.gridFocused).toBe(false);
  });

  it('exits grid focus and resets position on Escape while grid-focused', () => {
    const host = createHost();
    const nav = new KeyboardGridNavigation(host);
    nav.gridFocused = true;
    nav.activeRowIndex = 2;
    nav.activeColIndex = 1;

    nav.handleKeyDown(fakeEvent(KEY_CODE.ESC));

    expect(nav.gridFocused).toBe(false);
    expect(nav.activeRowIndex).toBe(-1);
    expect(nav.activeColIndex).toBe(0);
    expect(host.setActiveDescendant).toHaveBeenCalledWith('');
    expect(host.clearInputDeferred).not.toHaveBeenCalled();
  });
});
