import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Onboarding } from './onboarding';
import { TinyBase } from '../base';
import activities from '../../../config/config.json';

class TestHarness extends TinyBase {}
if (!customElements.get('test-harness-onboarding')) {
  customElements.define('test-harness-onboarding', TestHarness);
}

describe('Onboarding', () => {
  beforeEach(() => {
    if (!customElements.get('el-onboarding')) {
      customElements.define('el-onboarding', Onboarding);
    }
    document.body.innerHTML = '';
  });

  it('renders the current instruction step title and text', () => {
    const harness = document.createElement('test-harness-onboarding');
    const key = harness.setProps({ moveSpotlight: vi.fn(), moveModalTop: vi.fn() }, true);
    const el = document.createElement('el-onboarding');
    el.setAttribute('key', key);
    document.body.appendChild(el);

    const { title, text } = activities.instructions[0];
    expect(el.querySelector('h4').textContent).toBe(title);
    expect(el.innerHTML).toContain(text);
  });
});
