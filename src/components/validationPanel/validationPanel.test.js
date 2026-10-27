import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { appStore } from '../../store/appStore';
import {
  ADD_ENTRY,
  CLEAR_DIARY,
  DISMISS_ONBOARDING,
  HIDE_PANEL,
  RESET_ONBOARDING,
  SHOW_PANEL,
  SWITCH_DATE,
} from '../../store/actionTypes';
import '../contextualHelp/contextualHelp';
import './validationPanel';

const DATE = '2025-01-01';
const OTHER_DATE = '2025-01-02';
const ALL_RULES = {
  'no-gaps-in-primary': 'hard',
  'primary-secondary-differ': 'hard',
  'minimum-sleep': 'soft',
  'eating-or-drinking': 'soft',
};
const originalValidation = GLOBALS.DATA.validation;
const originalSubmitUrl = GLOBALS.DATA.general.submit_completed_diary_url;

let help;
let panelEl;
const panel = () => panelEl.querySelector('.validation-panel');
const isOpen = () => panel().classList.contains('open');
const results = () => [...panelEl.querySelectorAll('.validation-result')];
const setValidation = (validation) => (GLOBALS.DATA.validation = validation);
const open = () => appStore.dispatch({ type: SHOW_PANEL, payload: 'validation' });
const pressEscape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
const addEntry = (date, dimensionIndex, activity, id = dimensionIndex) =>
  appStore.dispatch({
    type: ADD_ENTRY,
    payload: { date, dimensionIndex, id, startOffsetMins: 0, endOffsetMins: 1440, activity },
  });

describe('ValidationPanel', () => {
  beforeEach(() => {
    appStore.dispatch({ type: HIDE_PANEL });
    appStore.dispatch({ type: DISMISS_ONBOARDING });
    appStore.dispatch({ type: SWITCH_DATE, payload: DATE });
    for (const date of [DATE, OTHER_DATE]) {
      appStore.dispatch({ type: CLEAR_DIARY, payload: { date } });
    }
    setValidation(ALL_RULES);
    document.body.innerHTML =
      '<el-contextual-help></el-contextual-help><el-validation-panel></el-validation-panel>';
    help = document.querySelector('el-contextual-help');
    panelEl = document.querySelector('el-validation-panel');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    GLOBALS.DATA.validation = originalValidation;
    GLOBALS.DATA.general.submit_completed_diary_url = originalSubmitUrl;
    appStore.dispatch({ type: HIDE_PANEL });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('opening and closing', () => {
    it('is closed to begin with, and out of the tab order', () => {
      expect(isOpen()).toBe(false);
      expect(panel().hasAttribute('inert')).toBe(true);
    });

    it('opens when the help button is clicked, and closes when it is clicked again', () => {
      const button = help.querySelector('button');

      button.click();
      expect(appStore.getState().uipanel).toBe('validation');
      expect(isOpen()).toBe(true);
      expect(panel().hasAttribute('inert')).toBe(false);
      expect(button.getAttribute('aria-expanded')).toBe('true');

      button.click();
      expect(appStore.getState().uipanel).toBeUndefined();
      expect(isOpen()).toBe(false);
      expect(button.getAttribute('aria-expanded')).toBe('false');
    });

    it('closes on Escape', () => {
      open();

      pressEscape();

      expect(isOpen()).toBe(false);
    });

    it('closes with its close button', () => {
      open();

      panelEl.querySelector('[data-close]').click();

      expect(isOpen()).toBe(false);
    });

    it('closes on a click outside it, but not on a click inside it', () => {
      open();

      panelEl.querySelector('.validation-header h2').click();
      expect(isOpen()).toBe(true);

      document.body.click();
      expect(isOpen()).toBe(false);
    });

    it('closes when another panel opens', () => {
      open();

      appStore.dispatch({ type: SHOW_PANEL, payload: 'date' });

      expect(isOpen()).toBe(false);
    });

    it('closes when the onboarding is shown', () => {
      open();

      appStore.dispatch({ type: RESET_ONBOARDING });

      expect(isOpen()).toBe(false);
      expect(appStore.getState().uipanel).toBeUndefined();
    });

    it('is a region labelled by its heading', () => {
      const labelledBy = panel().getAttribute('aria-labelledby');

      expect(panel().tagName).toBe('SECTION');
      expect(panelEl.querySelector(`#${labelledBy}`).textContent).toBe('Checks');
    });
  });

  describe('focus', () => {
    it('moves into the panel on open and back to the help button on close', () => {
      const button = help.querySelector('button');
      button.focus();

      button.click();
      expect(document.activeElement).toBe(panel());

      pressEscape();
      expect(document.activeElement).toBe(button);
    });
  });

  describe('results', () => {
    it('shows a cross for each rule an empty Diary fails', () => {
      open();

      // nothing recorded means no clash, so the differ rule passes
      expect(results().map((item) => item.classList.contains('failed'))).toEqual([
        true,
        false,
        true,
        true,
      ]);
    });

    it('says passed or failed in text as well as with an icon', () => {
      open();

      const first = results()[0];
      expect(first.querySelector('.validation-icon').getAttribute('aria-hidden')).toBe('true');
      expect(first.querySelector('.sr-only').textContent).toBe('failed');
      expect(first.querySelector('.validation-message').textContent).toContain('Primary activity');
    });

    it('lists only the rules that are on, and marks soft ones as advice', () => {
      setValidation({
        'no-gaps-in-primary': 'hard',
        'minimum-sleep': 'soft',
        'eating-or-drinking': 'off',
      });

      open();

      expect(results()).toHaveLength(2);
      expect(results()[0].textContent).not.toContain('advice');
      expect(results()[1].textContent).toContain('advice');
    });

    it('updates while it is open, without a reload', () => {
      open();
      expect(results()[0].classList.contains('failed')).toBe(true);

      addEntry(DATE, 0, 'Sleeping');

      const [noGaps] = results();
      expect(noGaps.classList.contains('passed')).toBe(true);
      expect(noGaps.querySelector('.sr-only').textContent).toBe('passed');
      expect(noGaps.querySelector('.validation-message')).toBeNull();
    });

    it('checks the Diary of the viewed date', () => {
      open();
      addEntry(OTHER_DATE, 0, 'Sleeping');
      expect(results()[0].classList.contains('failed')).toBe(true);

      appStore.dispatch({ type: SWITCH_DATE, payload: OTHER_DATE });

      expect(results()[0].classList.contains('passed')).toBe(true);
    });

    it('escapes an Activity name in a message', () => {
      open();
      const name = '<img src=x onerror=alert(1)>';

      addEntry(DATE, 0, name);
      addEntry(DATE, 1, name);

      expect(panelEl.querySelector('img')).toBeNull();
      expect(panelEl.textContent).toContain(name);
    });

    it('says no checks are set when every rule is off', () => {
      setValidation({});

      open();

      expect(results()).toHaveLength(0);
      expect(panelEl.querySelector('.validation-empty').textContent).toBe(
        'No checks are set for this study.'
      );
    });
  });

  describe('Diary complete button', () => {
    const HARD_ONLY = { 'no-gaps-in-primary': 'hard' };
    const WITH_SOFT = {
      'no-gaps-in-primary': 'hard',
      'minimum-sleep': 'soft',
      'eating-or-drinking': 'soft',
    };
    const button = () => panelEl.querySelector('.validation-complete');
    const confirmDialog = () => panelEl.querySelector('dialog');
    const isConfirmOpen = () => confirmDialog().hasAttribute('open');
    let fetchStub;

    beforeEach(() => {
      fetchStub = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal('fetch', fetchStub);
      vi.spyOn(console, 'log').mockImplementation(() => {});
      GLOBALS.DATA.general.submit_completed_diary_url = 'https://example.org/submit';
    });

    it('is not shown when the study has no submit URL', () => {
      GLOBALS.DATA.general.submit_completed_diary_url = '';

      open();

      expect(button().hidden).toBe(true);
      expect(results().length).toBeGreaterThan(0);
    });

    it('is disabled, with the reason, while a hard check fails', () => {
      setValidation(HARD_ONLY);

      open();

      expect(button().hidden).toBe(false);
      expect(button().disabled).toBe(true);
      const hint = panelEl.querySelector('.validation-complete-hint');
      expect(hint.hidden).toBe(false);
      expect(button().getAttribute('aria-describedby')).toBe(hint.id);
    });

    it('is enabled once every hard check passes, even when soft checks fail', () => {
      setValidation(WITH_SOFT);
      open();

      addEntry(DATE, 0, 'Working');

      expect(button().disabled).toBe(false);
      expect(panelEl.querySelector('.validation-complete-hint').hidden).toBe(true);
    });

    it('is disabled again when a hard check fails again', () => {
      setValidation(HARD_ONLY);
      open();
      addEntry(DATE, 0, 'Working');
      expect(button().disabled).toBe(false);

      appStore.dispatch({ type: CLEAR_DIARY, payload: { date: DATE } });

      expect(button().disabled).toBe(true);
    });

    it('submits at once, with no confirmation, when every check passes', () => {
      setValidation(HARD_ONLY);
      open();
      addEntry(DATE, 0, 'Working');

      button().click();

      expect(isConfirmOpen()).toBe(false);
      expect(fetchStub).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetchStub.mock.calls[0][1].body).date).toBe(DATE);
    });

    it('asks first, naming each failed soft check, when only soft checks fail', () => {
      setValidation(WITH_SOFT);
      open();
      addEntry(DATE, 0, 'Working');

      button().click();

      expect(isConfirmOpen()).toBe(true);
      expect(fetchStub).not.toHaveBeenCalled();
      const listed = [...panelEl.querySelectorAll('.validation-soft-failures li')];
      expect(listed).toHaveLength(2);
      expect(listed[0].textContent).toContain('At least 4 hours of sleep');
      expect(listed[1].textContent).toContain('Eating or drinking recorded');
    });

    it('sends nothing when the Respondent goes back', () => {
      setValidation(WITH_SOFT);
      open();
      addEntry(DATE, 0, 'Working');
      button().click();

      confirmDialog().querySelector('[data-close]').click();

      expect(isConfirmOpen()).toBe(false);
      expect(fetchStub).not.toHaveBeenCalled();
      expect(isOpen()).toBe(true);
    });

    it('submits once when the Respondent chooses Submit anyway', () => {
      setValidation(WITH_SOFT);
      open();
      addEntry(DATE, 0, 'Working');
      button().click();

      panelEl.querySelector('[data-confirm-submit]').click();

      expect(isConfirmOpen()).toBe(false);
      expect(fetchStub).toHaveBeenCalledTimes(1);
    });

    it('is cancelled by Escape, which does not also close the panel', () => {
      setValidation(WITH_SOFT);
      open();
      addEntry(DATE, 0, 'Working');
      button().click();

      pressEscape();
      expect(isOpen()).toBe(true);
      confirmDialog().dispatchEvent(new Event('cancel'));

      expect(isConfirmOpen()).toBe(false);
      expect(isOpen()).toBe(true);
      expect(fetchStub).not.toHaveBeenCalled();

      pressEscape();
      expect(isOpen()).toBe(false);
    });

    it('does not close the panel when the dialog is clicked', () => {
      setValidation(WITH_SOFT);
      open();
      addEntry(DATE, 0, 'Working');
      button().click();

      confirmDialog().click();

      expect(isOpen()).toBe(true);
    });

    it('escapes an Activity name in the confirmation', () => {
      setValidation({ 'no-gaps-in-primary': 'hard', 'primary-secondary-differ': 'soft' });
      open();
      const name = '<img src=x onerror=alert(1)>';
      addEntry(DATE, 0, name);
      addEntry(DATE, 1, name);

      button().click();

      expect(panelEl.querySelector('dialog img')).toBeNull();
      expect(panelEl.querySelector('.validation-soft-failures').textContent).toContain(name);
    });
  });
});
