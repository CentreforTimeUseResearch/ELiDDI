import { describe, it, expect, beforeEach } from 'vitest';
import { TimePicker } from './timePicker';

describe('TimePicker', () => {
  beforeEach(() => {
    if (!customElements.get('el-time-picker')) {
      customElements.define('el-time-picker', TimePicker);
    }
    document.body.innerHTML = '';
  });

  function createPicker(attrs = {}) {
    const el = document.createElement('el-time-picker');
    el.setAttribute('input-id', 'startTime');
    el.setAttribute('label', 'Start time');
    Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value));
    document.body.appendChild(el);
    return el;
  }

  it('renders a labelled time input', () => {
    const el = createPicker();
    const input = el.querySelector('input[data-id="startTime"]');
    expect(input).not.toBeNull();
    expect(el.querySelector('label').textContent).toContain('Start time');
  });

  it('shows a required-field error when left blank', () => {
    const el = createPicker({ required: 'true' });
    const input = el.querySelector('input');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('.error-text').hasAttribute('hidden')).toBe(false);
  });

  it('clears the error once a valid time is entered and blurred', () => {
    const el = createPicker({ required: 'true' });
    const input = el.querySelector('input');
    input.value = '09:30';
    input.dispatchEvent(new Event('blur'));
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(el.querySelector('.error-text').hasAttribute('hidden')).toBe(true);
  });
});
