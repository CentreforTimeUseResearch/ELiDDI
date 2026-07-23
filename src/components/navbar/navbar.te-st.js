import { describe, it, expect, beforeEach } from 'vitest';
import { Navbar } from './navbar';

describe('Navbar', () => {
  beforeEach(() => {
    if (!customElements.get('nav-bar')) {
      customElements.define('nav-bar', Navbar);
    }
    document.body.innerHTML = '';
  });

  it('renders sidebar html', () => {
    const el = document.createElement('nav-bar');
    document.body.appendChild(el);
    expect(el.innerHTML).toContain('<div class="off-screen-menu">');
    expect(el.innerHTML).toContain('nav');
  });

  it('toggles active class on sidebar menu and hamburger button when hamburger button clicked', async () => {
    const el = document.createElement('nav-bar');
    document.body.appendChild(el);

    expect(el.querySelector('.off-screen-menu').classList.contains('active')).toBe(false);
    expect(el.querySelector('.ham-menu').classList.contains('active')).toBe(false);

    el.querySelector('.ham-menu').click();

    expect(el.querySelector('.off-screen-menu').classList.contains('active')).toBe(true);
    expect(el.querySelector('.ham-menu').classList.contains('active')).toBe(true);

    el.querySelector('.ham-menu').click();
    expect(el.querySelector('.off-screen-menu').classList.contains('active')).toBe(false);
    expect(el.querySelector('.ham-menu').classList.contains('active')).toBe(false);
  });

  // todo: test that sidebar menu options are present
});
