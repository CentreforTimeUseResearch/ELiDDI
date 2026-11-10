import { describe, it, expect, beforeEach } from 'vitest';
import { KeyboardHelp } from './keyboardHelp';

describe('KeyboardHelp', () => {
  beforeEach(() => {
    if (!customElements.get('el-keyboard-help')) {
      customElements.define('el-keyboard-help', KeyboardHelp);
    }
    document.body.innerHTML = '';
  });

  function mount() {
    const el = document.createElement('el-keyboard-help');
    document.body.appendChild(el);
    return el;
  }

  const keysOf = (el) => [...el.querySelectorAll('kbd')].map((kbd) => kbd.textContent.trim());
  const text = (el) => el.textContent.replace(/\s+/g, ' ');

  it('has a heading, and says the shortcuts are for when a timeline has focus', () => {
    const el = mount();

    expect(el.querySelector('h2').textContent).toBe('Keyboard shortcuts');
    expect(text(el)).toContain('timeline has keyboard focus');
  });

  it('lists the shortcuts for the Dimension, the day and today', () => {
    const keys = keysOf(mount());

    for (const key of ['[', ']', ',', '.', 't']) {
      expect(keys).toContain(key);
    }
  });

  it('says what each of those does', () => {
    const el = mount();

    expect(text(el)).toMatch(/\[.*previous Dimension/);
    expect(text(el)).toMatch(/\].*next Dimension/);
    expect(text(el)).toMatch(/,.*previous day/);
    expect(text(el)).toMatch(/\..*next day/);
    expect(text(el)).toMatch(/t.*today/i);
  });

  it('also lists how to move around a timeline and how to move or resize an Entry', () => {
    const keys = keysOf(mount());

    for (const key of [
      'Home',
      'End',
      'Page Up',
      'Page Down',
      'Enter',
      'Space',
      'Escape',
      'Shift',
    ]) {
      expect(keys).toContain(key);
    }
  });

  it('can take focus, so that it can be scrolled from the keyboard, and is a named region', () => {
    const el = mount();

    expect(el.tabIndex).toBe(0);
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toBe('Keyboard shortcuts');
  });

  it('has a heading for each group of shortcuts', () => {
    const el = mount();

    expect([...el.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      'Moving around a timeline',
      'Moving or resizing an entry',
      'Switching Dimension and day',
    ]);
  });

  it('is a list of terms and what they do, so a screen reader pairs them', () => {
    const el = mount();

    const lists = el.querySelectorAll('dl');
    expect(lists.length).toBe(3);
    lists.forEach((list) => {
      expect(list.querySelectorAll('dt').length).toBe(list.querySelectorAll('dd').length);
      expect(list.querySelectorAll('dt').length).toBeGreaterThan(0);
    });
  });
});
