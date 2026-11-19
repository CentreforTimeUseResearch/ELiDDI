import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DurationInput } from './durationInput';
import { TinyBase } from '../base';

class TestHarness extends TinyBase {}
if (!customElements.get('test-harness-durationinput')) {
  customElements.define('test-harness-durationinput', TestHarness);
}

describe('DurationInput', () => {
  beforeEach(() => {
    if (!customElements.get('el-duration-input')) {
      customElements.define('el-duration-input', DurationInput);
    }
    document.body.innerHTML = '';
  });

  it('splits an initial value in minutes into hours and minutes fields', () => {
    const el = document.createElement('el-duration-input');
    el.setAttribute('input-id', 'duration');
    el.setAttribute('label', 'Duration');
    el.setAttribute('value', '95'); // 1h35

    document.body.appendChild(el);

    expect(el.querySelector('#duration-hours').value).toBe('1');
    expect(el.querySelector('#duration-minutes').value).toBe('35');
  });

  it('shows a label with quotes and markup as plain text (labels come from a translator-edited catalogue)', () => {
    const el = document.createElement('el-duration-input');
    el.setAttribute('input-id', 'duration');
    el.setAttribute('label', `Durée "totale" <b>en</b> heures`);
    document.body.appendChild(el);

    expect(el.querySelector('legend').textContent).toBe(`Durée "totale" <b>en</b> heures`);
    expect(el.querySelector('legend b')).toBeNull();
  });

  it('shows an error when hours exceeds 24', () => {
    const el = document.createElement('el-duration-input');
    el.setAttribute('input-id', 'duration');
    el.setAttribute('label', 'Duration');
    document.body.appendChild(el);

    const hoursInput = el.querySelector('#duration-hours');
    hoursInput.value = '25';
    hoursInput.dispatchEvent(new Event('change'));

    expect(hoursInput.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('#duration-error').hasAttribute('hidden')).toBe(false);
  });

  it('accepts 24 hours, a whole day, but not minutes on top of it', () => {
    const change = vi.fn();
    const harness = document.createElement('test-harness-durationinput');
    const el = document.createElement('el-duration-input');
    el.setAttribute('key', harness.setProps({ change }, true));
    el.setAttribute('input-id', 'duration');
    el.setAttribute('label', 'Duration');
    document.body.appendChild(el);

    const hoursInput = el.querySelector('#duration-hours');
    const minutesInput = el.querySelector('#duration-minutes');
    hoursInput.value = '24';
    hoursInput.dispatchEvent(new Event('change'));
    expect(hoursInput.getAttribute('aria-invalid')).not.toBe('true');
    expect(change).toHaveBeenLastCalledWith(1440);

    minutesInput.value = '30';
    minutesInput.dispatchEvent(new Event('change'));
    expect(minutesInput.getAttribute('aria-invalid')).toBe('true');
  });
});
