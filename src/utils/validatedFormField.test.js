import { describe, it, expect, vi } from 'vitest';
import {
  handleValidatedFieldAttributeChange,
  showFieldError,
  clearFieldError,
  VALUE_ATTR,
} from './validatedFormField';

function createErrorDisplay() {
  const el = document.createElement('span');
  el.setAttribute('hidden', 'true');
  return el;
}

function createInput() {
  return document.createElement('input');
}

describe('handleValidatedFieldAttributeChange', () => {
  it('re-renders, re-binds handlers, and re-validates when the value attribute changes', () => {
    const component = {
      render: vi.fn(),
      assignEventHandlers: vi.fn(),
      validate: vi.fn(),
    };

    handleValidatedFieldAttributeChange(component, VALUE_ATTR, '90');

    expect(component[VALUE_ATTR]).toBe('90');
    expect(component.render).toHaveBeenCalledOnce();
    expect(component.assignEventHandlers).toHaveBeenCalledOnce();
    expect(component.validate).toHaveBeenCalledOnce();
  });

  it('does not re-render for a non-value attribute', () => {
    const component = { render: vi.fn(), assignEventHandlers: vi.fn(), validate: vi.fn() };

    handleValidatedFieldAttributeChange(component, 'label', 'Start time');

    expect(component.label).toBe('Start time');
    expect(component.render).not.toHaveBeenCalled();
  });

  it('normalizes the literal string "undefined" to real undefined', () => {
    const component = { render: vi.fn(), assignEventHandlers: vi.fn(), validate: vi.fn() };

    handleValidatedFieldAttributeChange(component, VALUE_ATTR, 'undefined');

    expect(component[VALUE_ATTR]).toBeUndefined();
  });

  it('is a no-op when the attribute value has not actually changed', () => {
    const component = { render: vi.fn(), assignEventHandlers: vi.fn(), validate: vi.fn() };
    component[VALUE_ATTR] = '90';

    handleValidatedFieldAttributeChange(component, VALUE_ATTR, '90');

    expect(component.render).not.toHaveBeenCalled();
  });
});

describe('showFieldError / clearFieldError', () => {
  it('marks a single input invalid and shows the message', () => {
    const errorDisplay = createErrorDisplay();
    const input = createInput();

    showFieldError(errorDisplay, input, 'This field is required.');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(errorDisplay.textContent).toBe('This field is required.');
    expect(errorDisplay.hasAttribute('hidden')).toBe(false);
  });

  it('marks every input in an array invalid (DurationInput has two)', () => {
    const errorDisplay = createErrorDisplay();
    const hours = createInput();
    const minutes = createInput();

    showFieldError(errorDisplay, [hours, minutes], 'Enter a valid duration.');

    expect(hours.getAttribute('aria-invalid')).toBe('true');
    expect(minutes.getAttribute('aria-invalid')).toBe('true');
  });

  it('clears the error and hides the display again', () => {
    const errorDisplay = createErrorDisplay();
    const input = createInput();
    showFieldError(errorDisplay, input, 'Bad value');

    clearFieldError(errorDisplay, input);

    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(errorDisplay.textContent).toBe('');
    expect(errorDisplay.hasAttribute('hidden')).toBe(true);
  });
});
