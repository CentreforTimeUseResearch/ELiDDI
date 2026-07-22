import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicTimelineUI } from './dynamicTimelineUI.js';

describe('DynamicTimelineUI', () => {
  beforeEach(() => {
    if (!customElements.get('dynamic-timeline')) {
      customElements.define('dynamic-timeline', DynamicTimelineUI);
    }
    document.body.innerHTML = '';
  });

  it('renders sidebar and activity panel', () => {
    const el = document.createElement('dynamic-timeline');
    document.body.appendChild(el);
    expect(el.innerHTML).toContain('activity-panel');
    expect(el.innerHTML).toContain('nav-bar');
  });
});
