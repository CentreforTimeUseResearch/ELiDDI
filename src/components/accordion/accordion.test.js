import { describe, it, expect, beforeEach, vi } from 'vitest';
import './accordion.js';
import { setProps } from '../propsRegistry';

const CONTENT = [
  {
    name: 'Personal',
    activities: [
      { name: 'sleeping', color: '#123456' },
      { name: 'resting', color: '#654321' },
    ],
  },
  { name: 'Work', activities: [{ name: 'working', color: '#abcdef' }] },
];

describe('Accordion', () => {
  let activitySelect;
  let activityToggle;

  beforeEach(() => {
    document.body.innerHTML = '';
    activitySelect = vi.fn();
    activityToggle = vi.fn();
  });

  // setProps binds each function to the owner, so assertions go against the
  // original vi.fn() references - the bound wrappers still call through
  function createAccordion({ multi = false } = {}) {
    const el = document.createElement('el-accordion');
    el.setAttribute('dimensionindex', '0');
    const key = setProps({}, { content: CONTENT, activitySelect, activityToggle, multi }, true);
    el.setAttribute('key', key);
    document.body.appendChild(el);
    return el;
  }

  function sectionFor(el, trigger) {
    return el.querySelector(`[id="${trigger.getAttribute('aria-controls')}"]`);
  }

  // regression coverage (#144): the section used to be resolved via
  // element.ariaControlsElements, an ARIA element-reflection API that is
  // null on any element without aria-controls and not implemented at all in
  // jsdom - reading the aria-controls attribute works everywhere
  it('collapses and re-expands a section when its header is clicked', () => {
    const el = createAccordion();
    const trigger = el.querySelector('.accordion-trigger');
    const section = sectionFor(el, trigger);

    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(section.hasAttribute('hidden')).toBe(true);

    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(section.hasAttribute('hidden')).toBe(false);
  });

  // regression coverage (#144): a click on neither an activity button nor a
  // header - the panel background, an activity button's wrapper <span> -
  // read ariaControlsElements[0] off an element with no aria-controls and
  // threw a TypeError
  it('ignores a click on a non-interactive area instead of throwing', () => {
    const el = createAccordion();
    const panel = el.querySelector('.accordion-panel');
    const wrapperSpan = el.querySelector('.accordion-panel span');

    for (const target of [panel, wrapperSpan]) {
      expect(() => el.handleClick({ target, stopPropagation() {} })).not.toThrow();
    }
    expect(activitySelect).not.toHaveBeenCalled();
    expect(el.querySelector('.accordion-trigger').getAttribute('aria-expanded')).toBe('true');
  });

  it('calls activitySelect with the activity name in single-choice mode', () => {
    const el = createAccordion();

    el.querySelector('[data-activity="resting"]').click();

    expect(activitySelect).toHaveBeenCalledWith('resting');
    expect(activityToggle).not.toHaveBeenCalled();
  });

  it('toggles aria-pressed and reports each toggle in multiple-choice mode', () => {
    const el = createAccordion({ multi: true });
    const button = el.querySelector('[data-activity="working"]');

    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(activityToggle).toHaveBeenLastCalledWith('working', true);

    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(activityToggle).toHaveBeenLastCalledWith('working', false);
    expect(activitySelect).not.toHaveBeenCalled();
  });
});
