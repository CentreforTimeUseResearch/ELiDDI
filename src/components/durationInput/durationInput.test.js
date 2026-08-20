import { describe, it, expect, beforeEach } from 'vitest';
import { DurationInput } from './durationInput';

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

  it('shows an error when hours exceeds 23', () => {
    const el = document.createElement('el-duration-input');
    el.setAttribute('input-id', 'duration');
    el.setAttribute('label', 'Duration');
    document.body.appendChild(el);

    const hoursInput = el.querySelector('#duration-hours');
    hoursInput.value = '24';
    hoursInput.dispatchEvent(new Event('change'));

    expect(hoursInput.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('#duration-error').hasAttribute('hidden')).toBe(false);
  });
});
