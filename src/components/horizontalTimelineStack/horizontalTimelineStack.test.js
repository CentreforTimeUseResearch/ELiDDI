import { describe, it, expect, beforeEach } from 'vitest';
import { HorizontalTimelineStack } from './horizontalTimelineStack';

const DIMENSION_COUNT = GLOBALS.DATA.timeline.length;

describe('HorizontalTimelineStack', () => {
  beforeEach(() => {
    if (!customElements.get('el-horizontal-timeline-stack')) {
      customElements.define('el-horizontal-timeline-stack', HorizontalTimelineStack);
    }
    // setting innerHTML upgrades any already-defined custom element it
    // parses immediately, connected to the document or not (unlike a plain
    // HTMLElement, which only needs its template once it actually renders)
    // - el-horizontal-timeline-axis/el-horizontal-timeline both look up
    // their own #svg-horizontal-timeline-* <template> in their constructor,
    // so render() needs these present even though this test never connects
    // the stack itself (same minimal-template approach
    // horizontalTimeline.test.js/horizontalTimelineAxis.test.js use).
    if (!document.getElementById('svg-horizontal-timeline-axis')) {
      const template = document.createElement('template');
      template.id = 'svg-horizontal-timeline-axis';
      template.innerHTML = `
        <svg>
          <rect id="future-overlay"></rect>
          <g id="grid-lines"></g>
          <g id="hour-labels"></g>
        </svg>
      `;
      document.head.appendChild(template);
    }
    if (!document.getElementById('svg-horizontal-timeline-row')) {
      const template = document.createElement('template');
      template.id = 'svg-horizontal-timeline-row';
      template.innerHTML = `
        <svg>
          <g id="events"></g>
        </svg>
      `;
      document.head.appendChild(template);
    }
  });

  // render() is checked on a disconnected instance - the mounted children
  // construct correctly (see the templates above) but never connect, so
  // none of their own connectedCallback-driven store wiring runs.
  it('mounts one axis followed by one row per Dimension, in order', () => {
    const el = document.createElement('el-horizontal-timeline-stack');

    el.render();

    expect(el.children.length).toBe(DIMENSION_COUNT + 1);
    expect(el.children[0].tagName.toLowerCase()).toBe('el-horizontal-timeline-axis');
    for (let i = 0; i < DIMENSION_COUNT; i++) {
      const row = el.children[i + 1];
      expect(row.tagName.toLowerCase()).toBe('el-horizontal-timeline');
      expect(row.getAttribute('index')).toBe(String(i));
    }
  });
});
