import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { appStore } from '../../store/appStore';
import {
  ADD_ENTRY,
  CLEAR_DIARY,
  HIDE_PANEL,
  SHOW_PANEL,
  SWITCH_DATE,
} from '../../store/actionTypes';
import helpIconSource from '../../assets/icons/help-252.svg?raw';
import doneIconSource from '../../assets/icons/check-252.svg?raw';
import './contextualHelp';

const DATE = '2025-01-01';
const OTHER_DATE = '2025-01-02';
// the markup as the browser serialises it, to compare with the button's
const serialised = (svgSource) => {
  const holder = document.createElement('div');
  holder.innerHTML = svgSource;
  return holder.innerHTML;
};
const originalValidation = GLOBALS.DATA.validation;

const addEntry = (date, dimensionIndex, activity, id = dimensionIndex) =>
  appStore.dispatch({
    type: ADD_ENTRY,
    payload: { date, dimensionIndex, id, startOffsetMins: 0, endOffsetMins: 1440, activity },
  });

describe('ContextualHelp', () => {
  let button;
  const mount = () => {
    document.body.innerHTML = '<el-contextual-help></el-contextual-help>';
    button = document.querySelector('el-contextual-help button');
  };
  const showsCheckMark = () => button.innerHTML.trim() === serialised(doneIconSource).trim();
  const showsQuestionMark = () => button.innerHTML.trim() === serialised(helpIconSource).trim();

  beforeEach(() => {
    appStore.dispatch({ type: HIDE_PANEL });
    appStore.dispatch({ type: SWITCH_DATE, payload: DATE });
    for (const date of [DATE, OTHER_DATE]) {
      appStore.dispatch({ type: CLEAR_DIARY, payload: { date } });
    }
    GLOBALS.DATA.validation = {
      'no-gaps-in-primary': 'hard',
      'primary-secondary-differ': 'hard',
      'minimum-sleep': 'soft',
      'eating-or-drinking': 'soft',
    };
    mount();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    GLOBALS.DATA.validation = originalValidation;
  });

  describe('opening the validation panel', () => {
    it('shows the validation panel when clicked', () => {
      button.click();

      expect(appStore.getState().uipanel).toBe('validation');
    });

    it('hides the validation panel when clicked while it is open', () => {
      button.click();
      button.click();

      expect(appStore.getState().uipanel).toBeUndefined();
    });

    it('opens the validation panel even when another panel is showing', () => {
      appStore.dispatch({ type: SHOW_PANEL, payload: 'date' });

      button.click();

      expect(appStore.getState().uipanel).toBe('validation');
    });

    it('reports whether the panel is open in aria-expanded', () => {
      expect(button.getAttribute('aria-expanded')).toBe('false');

      appStore.dispatch({ type: SHOW_PANEL, payload: 'validation' });

      expect(button.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('icon', () => {
    it('is a question mark for an empty Diary', () => {
      expect(showsQuestionMark()).toBe(true);
      expect(button.getAttribute('aria-label')).toBe('Diary checks: not ready');
    });

    it('becomes a check mark once the hard checks pass, without a reload', () => {
      addEntry(DATE, 0, 'Sleeping');

      expect(showsCheckMark()).toBe(true);
      expect(button.getAttribute('aria-label')).toBe('Diary checks: ready to submit');
    });

    it('stays a check mark when only soft checks fail', () => {
      addEntry(DATE, 0, 'Working'); // no sleep, no eating: both soft rules fail

      expect(showsCheckMark()).toBe(true);
    });

    it('goes back to a question mark when a hard check fails again', () => {
      addEntry(DATE, 0, 'Sleeping');
      expect(showsCheckMark()).toBe(true);

      addEntry(DATE, 1, 'Sleeping'); // the same Activity as Primary and Secondary

      expect(showsQuestionMark()).toBe(true);
      expect(button.getAttribute('aria-label')).toBe('Diary checks: not ready');
    });

    it('is a question mark when the study has no active rules', () => {
      GLOBALS.DATA.validation = { 'no-gaps-in-primary': 'off' };
      mount();
      addEntry(DATE, 0, 'Sleeping');

      expect(showsQuestionMark()).toBe(true);
      expect(button.getAttribute('aria-label')).toBe('Diary checks');
    });

    it('follows the Diary of the viewed date', () => {
      addEntry(OTHER_DATE, 0, 'Sleeping');
      expect(showsQuestionMark()).toBe(true);

      appStore.dispatch({ type: SWITCH_DATE, payload: OTHER_DATE });
      expect(showsCheckMark()).toBe(true);

      appStore.dispatch({ type: SWITCH_DATE, payload: DATE });
      expect(showsQuestionMark()).toBe(true);
    });

    it('keeps the same button, so it keeps focus, when the icon changes', () => {
      button.focus();

      addEntry(DATE, 0, 'Sleeping');

      expect(document.querySelector('el-contextual-help button')).toBe(button);
      expect(document.activeElement).toBe(button);
    });
  });
});
