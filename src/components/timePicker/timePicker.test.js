import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimePicker } from './timePicker';
import { TinyBase } from '../base';

class TestHarness extends TinyBase {}
if (!customElements.get('test-harness-timepicker')) {
  customElements.define('test-harness-timepicker', TestHarness);
}

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

  // constrained behavior now comes entirely from a getMaxTime prop callback
  // (supplied by TimePickerPanel in real use) rather than TimePicker
  // computing wall-clock "now" itself - wire it up the same way
  // TimePickerPanel does, via setProps/key.
  function createConstrainedPicker(getMaxTime, attrs = {}) {
    const harness = document.createElement('test-harness-timepicker');
    const key = harness.setProps({ change: vi.fn(), getMaxTime }, true);
    const el = document.createElement('el-time-picker');
    el.setAttribute('key', key);
    el.setAttribute('input-id', 'startTime');
    el.setAttribute('label', 'Start time');
    el.setAttribute('constrained', 'true');
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

  // regression test: a constrained picker's 30s "now" polling interval
  // used to never be cleared, so every re-render (TimePickerPanel rebuilds
  // these on most edits) left the previous interval running forever
  it('clears its constrained-time polling interval on disconnect', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const el = createPicker({ constrained: 'true' });

    el.remove();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    clearIntervalSpy.mockRestore();
  });

  // regression coverage: the future-time cutoff used to be computed
  // internally from wall-clock new Date(), with no awareness of which
  // diary date was being edited - it now comes from a getMaxTime prop
  // supplied by the caller (TimePickerPanel), which decides that.
  it('rejects a value after the supplied max time', () => {
    const el = createConstrainedPicker(() => '10:00');
    const input = el.querySelector('input');
    input.value = '10:30';
    input.dispatchEvent(new Event('blur'));

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('.error-text').textContent).toContain('Time cannot be in the future');
  });

  it('accepts a value at or before the supplied max time', () => {
    const el = createConstrainedPicker(() => '10:00');
    const input = el.querySelector('input');
    input.value = '10:00';
    input.dispatchEvent(new Event('blur'));

    expect(input.getAttribute('aria-invalid')).toBe('false');
  });

  it('applies no constraint when getMaxTime returns undefined (e.g. editing a past diary day)', () => {
    const el = createConstrainedPicker(() => undefined);
    const input = el.querySelector('input');

    input.value = '23:59';
    input.dispatchEvent(new Event('blur'));

    expect(input.getAttribute('aria-invalid')).toBe('false');
  });
});
