import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicTimelineUI } from './dynamicTimelineUI.js';

describe('DynamicTimelineUI', () => {
  beforeEach(() => {
    if (!customElements.get('dynamic-timeline')) {
      customElements.define('dynamic-timeline', DynamicTimelineUI);
    }
    document.body.innerHTML = '';
  });

  // render() is checked on a disconnected instance - connecting it would
  // upgrade every child tag (nav-bar, el-timeline-stack, el-dialog) and
  // cascade into their full render trees, which need DOM/markup (e.g. the
  // #svg-timeline <template> in index.html) this unit test isn't set up to
  // provide.
  it('renders nav-bar, timeline-stack, and dialog', () => {
    const el = document.createElement('dynamic-timeline');
    el.render();
    expect(el.innerHTML).toContain('<nav-bar>');
    expect(el.innerHTML).toContain('<el-timeline-stack>');
    expect(el.innerHTML).toContain('<el-dialog');
  });
});
