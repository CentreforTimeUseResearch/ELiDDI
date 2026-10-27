import { describe, it, expect, beforeEach } from 'vitest';
import { appStore } from '../../store/appStore';
import { HIDE_PANEL, SHOW_PANEL } from '../../store/actionTypes';
import './contextualHelp';

describe('ContextualHelp', () => {
  let button;

  beforeEach(() => {
    appStore.dispatch({ type: HIDE_PANEL });
    document.body.innerHTML = '<el-contextual-help></el-contextual-help>';
    button = document.querySelector('el-contextual-help button');
  });

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

  it('has an accessible name', () => {
    expect(button.getAttribute('aria-label')).toBe('Checks');
  });
});
