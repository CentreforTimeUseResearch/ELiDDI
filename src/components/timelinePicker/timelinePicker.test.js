import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimelinePicker } from './timelinePicker';
import { appStore } from '../../store/appStore';
import { SHOW_PANEL, HIDE_PANEL, SWITCH_DIMENSION } from '../../store/actionTypes';

const DIMENSIONS = GLOBALS.DATA.timeline;

// The Dimension switcher on a narrow screen: a native <select>
describe('TimelinePicker', () => {
  beforeEach(() => {
    if (!customElements.get('el-timeline-picker')) {
      customElements.define('el-timeline-picker', TimelinePicker);
    }
    document.body.innerHTML = '';
    appStore.dispatch({ type: HIDE_PANEL });
    appStore.dispatch({ type: SWITCH_DIMENSION, payload: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mount() {
    const el = document.createElement('el-timeline-picker');
    document.body.appendChild(el);
    return el;
  }
  const select = (el) => el.querySelector('select');
  const choose = (el, index) => {
    select(el).value = String(index);
    select(el).dispatchEvent(new Event('change', { bubbles: true }));
  };

  it('lists every Dimension by name, with the current one selected', () => {
    appStore.dispatch({ type: SWITCH_DIMENSION, payload: 2 });
    const el = mount();

    const options = [...select(el).options];
    expect(options.map((option) => option.textContent)).toEqual(DIMENSIONS.map((d) => d.name));
    expect(select(el).value).toBe('2');
  });

  // there was no label at all, so a screen reader said only "combo box"
  it('has an accessible name', () => {
    const el = mount();

    expect(select(el).getAttribute('aria-label')).toBe('Dimension');
  });

  it('does not point at a description that is not there', () => {
    const el = mount();

    const describedBy = select(el).getAttribute('aria-describedby');
    expect(describedBy === null || document.getElementById(describedBy) !== null).toBe(true);
  });

  it('switches Dimension, and hides the details panel, when one is chosen', () => {
    appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });
    const el = mount();

    choose(el, 3);

    expect(appStore.getState().currentDimensionIndex).toBe(3);
    expect(appStore.getState().uipanel).not.toBe('details');
  });

  // choosing rebuilt the whole <select>, so keyboard focus was lost and the
  // next arrow key went nowhere
  it('keeps the same <select>, and keyboard focus, when a Dimension is chosen', () => {
    const el = mount();
    const original = select(el);
    original.focus();

    choose(el, 1);
    choose(el, 2);

    expect(select(el)).toBe(original);
    expect(document.activeElement).toBe(original);
    expect(select(el).value).toBe('2');
  });

  it('follows the Dimension when it changes elsewhere, without rebuilding the <select>', () => {
    const el = mount();
    const original = select(el);

    appStore.dispatch({ type: SWITCH_DIMENSION, payload: 4 });

    expect(select(el)).toBe(original);
    expect(select(el).value).toBe('4');
  });

  it('ignores a store update that is not a Dimension change', () => {
    const el = mount();
    const original = select(el);

    appStore.dispatch({ type: SHOW_PANEL, payload: 'details' });

    expect(select(el)).toBe(original);
    expect(select(el).value).toBe('0');
  });
});
