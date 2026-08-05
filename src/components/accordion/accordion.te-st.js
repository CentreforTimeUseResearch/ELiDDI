import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { Accordion } from './accordion.js';

describe('Accordion', () => {
  beforeEach(() => {
    if (!customElements.get('el-accordion')) {
      customElements.define('el-accordion', Accordion);
    }
    document.body.innerHTML = '';
  });

  it('renders accordion html', () => {
    const el = document.createElement('el-accordion');
    document.body.appendChild(el);
    expect(el.outerHTML).toContain('<el-accordion>');
  });

  // more tests to come
});
