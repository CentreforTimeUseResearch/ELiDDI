import { describe, it, expect } from 'vitest';
import { Timeline } from './timeline';

// renderEntriesInto is the renderer shared by renderEntries() and
// renderShadowDimension() (previously ~45 lines duplicated between them,
// differing only in width/x-offset/target-layer). It doesn't touch `this`,
// so it can be called directly off the prototype without constructing a
// full Timeline instance (which requires the #svg-timeline <template> from
// index.html to exist in the document).
const renderEntriesInto = Timeline.prototype.renderEntriesInto;

function createSvgLayer() {
  return document.createElementNS('http://www.w3.org/2000/svg', 'g');
}

describe('Timeline.renderEntriesInto', () => {
  it('renders one <g> per entry with a positioned rect and a labelled foreignObject', () => {
    const layer = createSvgLayer();
    const entries = [{ id: 1, startOffsetMins: 60, endOffsetMins: 90, activity: 'Sleep' }];

    renderEntriesInto({
      layer,
      entries,
      dimensionIndex: 0,
      blockWidth: '220',
      labelX: 110,
      labelWidth: 200,
    });

    const group = layer.querySelector('g');
    expect(group).not.toBeNull();

    const rect = group.querySelector('rect');
    expect(rect.getAttribute('x')).toBe('100');
    expect(rect.getAttribute('y')).toBe('120'); // 60min * 2px/min
    expect(rect.getAttribute('height')).toBe('60'); // (90-60)min * 2px/min
    expect(rect.getAttribute('width')).toBe('220');
    expect(rect.getAttribute('data-id')).toBe('1');

    const foreignObject = group.querySelector('foreignObject');
    expect(foreignObject.getAttribute('x')).toBe('110');
    expect(foreignObject.getAttribute('width')).toBe('200');
    expect(foreignObject.querySelector('.event-label').textContent).toBe('Sleep');
  });

  // pixel-identical to the pre-refactor renderShadowDimension() output
  it('renders a narrower block using the shadow-dimension parameters', () => {
    const layer = createSvgLayer();
    const entries = [{ id: 2, startOffsetMins: 0, endOffsetMins: 30, activity: 'Wake up' }];

    renderEntriesInto({
      layer,
      entries,
      dimensionIndex: 0,
      blockWidth: '50',
      labelX: 100,
      labelWidth: 50,
    });

    const rect = layer.querySelector('rect');
    expect(rect.getAttribute('width')).toBe('50');
    const foreignObject = layer.querySelector('foreignObject');
    expect(foreignObject.getAttribute('x')).toBe('100');
    expect(foreignObject.getAttribute('width')).toBe('50');
  });

  it('clears the layer before rendering, leaving no stale entries behind', () => {
    const layer = createSvgLayer();
    layer.innerHTML = '<g data-stale="true"></g>';

    renderEntriesInto({
      layer,
      entries: [],
      dimensionIndex: 0,
      blockWidth: '220',
      labelX: 110,
      labelWidth: 200,
    });

    expect(layer.querySelector('[data-stale]')).toBeNull();
  });

  it('joins a multiple-choice (array) activity into a comma-separated label', () => {
    const layer = createSvgLayer();
    const entries = [
      { id: 3, startOffsetMins: 0, endOffsetMins: 10, activity: ['Cooking', 'Childcare'] },
    ];

    renderEntriesInto({
      layer,
      entries,
      dimensionIndex: 0,
      blockWidth: '220',
      labelX: 110,
      labelWidth: 200,
    });

    expect(layer.querySelector('.event-label').textContent).toBe('Cooking, Childcare');
  });
});
