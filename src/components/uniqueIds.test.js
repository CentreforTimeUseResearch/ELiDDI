import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installSvgTemplates } from '../testing/svgTemplates';
import './dynamicTimelineUI/dynamicTimelineUI';
import { appStore } from '../store/appStore';
import { HIDE_PANEL, SWITCH_DIMENSION } from '../store/actionTypes';

// #170: with the whole app UI mounted in either layout - nav, six Timelines
// cloned from the same <template>, the one details panel, both dialogs -
// every id in the document is unique, and every url(#…) reference has
// exactly one target
describe.each([
  ['mobile', false, 'el-timeline-stack'],
  ['desktop', true, 'el-horizontal-timeline-stack'],
])('ids with the %s layout mounted', (_, isDesktopLayout, stackTag) => {
  let app;

  beforeEach(() => {
    installSvgTemplates();
    document.body.innerHTML = '';
    // jsdom has no matchMedia; without one the app always picks mobile
    window.matchMedia = () => ({
      matches: isDesktopLayout,
      addEventListener() {},
      removeEventListener() {},
    });
    appStore.dispatch({ type: SWITCH_DIMENSION, payload: 0 });
    appStore.dispatch({ type: HIDE_PANEL });
    app = document.createElement('el-dynamic-timeline');
    document.body.appendChild(app);
  });

  afterEach(() => {
    app.remove();
    delete window.matchMedia;
  });

  it('mounts the layout', () => {
    expect(document.querySelectorAll(stackTag)).toHaveLength(1);
  });

  it('gives every element id a single owner in the whole document', () => {
    const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
    const repeated = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];

    expect(repeated).toEqual([]);
  });

  it('resolves every url(#…) reference, such as the time-of-day gradient, to exactly one element', () => {
    // matched in JS: jsdom's selector engine misreads `[fill^="url(#"]`
    const references = [...document.querySelectorAll('[fill], [stroke]')]
      .flatMap((element) => [element.getAttribute('fill'), element.getAttribute('stroke')])
      .filter((value) => value?.startsWith('url(#'))
      .map((value) => value.slice('url(#'.length, -1));

    expect(references.length).toBeGreaterThan(0);
    references.forEach((id) => {
      expect(document.querySelectorAll(`[id="${id}"]`), id).toHaveLength(1);
    });
  });
});
