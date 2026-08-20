// Shared behavior for TinyBase form-field components that validate their
// own value and show/clear an inline error (TimePicker, DurationInput).
// Both independently re-implemented the same input-id/label/value
// attribute names, the same "value attribute changed -> re-render,
// re-bind handlers, re-validate" cycle, and the same aria-invalid/
// aria-live error display - this module is the single source of truth for
// that shared plumbing so the two can't quietly drift apart.

export const INPUT_ID_ATTR = 'input-id';
export const LABEL_ATTR = 'label';
export const VALUE_ATTR = 'value';

// Call from attributeChangedCallback(name, oldValue, newValue) - re-renders
// (and re-validates) only when the value attribute itself changes, matching
// the pattern both components already followed independently.
export function handleValidatedFieldAttributeChange(component, name, newValue) {
  if (component[name] !== newValue) {
    component[name] = newValue === 'undefined' ? undefined : newValue;
    if (name === VALUE_ATTR) {
      component.render();
      component.assignEventHandlers();
      component.validate();
    }
  }
}

// inputElements may be a single element or an array - DurationInput has
// two (hours/minutes) that both need aria-invalid toggled together.
export function showFieldError(errorDisplayElement, inputElements, message) {
  const inputs = Array.isArray(inputElements) ? inputElements : [inputElements];
  inputs.forEach((input) => input.setAttribute('aria-invalid', 'true'));
  errorDisplayElement.textContent = message;
  errorDisplayElement.removeAttribute('hidden');
}

export function clearFieldError(errorDisplayElement, inputElements) {
  const inputs = Array.isArray(inputElements) ? inputElements : [inputElements];
  inputs.forEach((input) => input.setAttribute('aria-invalid', 'false'));
  errorDisplayElement.textContent = '';
  errorDisplayElement.setAttribute('hidden', 'true');
}
