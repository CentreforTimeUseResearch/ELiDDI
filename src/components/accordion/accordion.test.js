import { describe, it, expect, beforeEach, vi } from 'vitest';
import './accordion.js';
import { setProps } from '../propsRegistry';
import { SPECIAL_DIMENSION, SPECIAL_NAMES } from '../../testing/specialCharacters';

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
  function createAccordion({ multi = false, content = CONTENT } = {}) {
    const el = document.createElement('el-accordion');
    el.setAttribute('dimensionindex', '0');
    const key = setProps({}, { content, activitySelect, activityToggle, multi }, true);
    el.setAttribute('key', key);
    document.body.appendChild(el);
    return el;
  }

  // regression coverage (#146): names went into attributes and text
  // unescaped, so a quote ended data-activity early and the wrong (or an
  // empty) activity was what got saved
  describe('activity names containing HTML special characters', () => {
    const buttons = (el) => [...el.querySelectorAll('[data-activity]')];

    it('displays, labels and stores each name exactly', () => {
      const el = createAccordion({ content: SPECIAL_DIMENSION.categories });

      expect(buttons(el).map((button) => button.textContent.trim())).toEqual(SPECIAL_NAMES);
      expect(buttons(el).map((button) => button.dataset.activity)).toEqual(SPECIAL_NAMES);
      expect(buttons(el).map((button) => button.getAttribute('aria-label'))).toEqual(SPECIAL_NAMES);
      expect(el.querySelector('.accordion-title').textContent.trim()).toBe(
        SPECIAL_DIMENSION.categories[0].name
      );
    });

    it('selects the exact name that was clicked', () => {
      const el = createAccordion({ content: SPECIAL_DIMENSION.categories });

      buttons(el).forEach((button) => button.click());

      expect(activitySelect.mock.calls.map(([name]) => name)).toEqual(SPECIAL_NAMES);
    });

    it('gives each button only the attributes it is meant to have', () => {
      const el = createAccordion({ content: SPECIAL_DIMENSION.categories });

      buttons(el).forEach((button) => {
        expect(button.getAttributeNames().sort()).toEqual(
          ['aria-label', 'class', 'data-activity', 'style', 'type'].sort()
        );
      });
    });
  });

  // regression coverage (#146): a `;` outside the template expression
  // rendered as stray text after the sections
  it('renders no stray text between its sections', () => {
    const el = createAccordion();
    const strayText = [...el.querySelector('.accordion').childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim())
      .filter(Boolean);

    expect(strayText).toEqual([]);
  });

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
