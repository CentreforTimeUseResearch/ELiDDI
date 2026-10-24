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

  // regression coverage (#146): a title is plain text, so it's escaped;
  // the step text is deliberately HTML (the real config uses <strong>)
  it('shows a title containing HTML special characters as text, and the step text as HTML', () => {
    const step = GLOBALS.DATA.instructions[0];
    const original = { ...step };
    step.title = `Let's "begin" <now>`;
    step.text = 'Use the <strong>timeline picker</strong>';
    try {
      const harness = document.createElement('test-harness-onboarding');
      const key = harness.setProps({ moveSpotlight: vi.fn(), moveModalTop: vi.fn() }, true);
      const el = document.createElement('el-onboarding');
      el.setAttribute('key', key);
      document.body.appendChild(el);

      expect(el.querySelector('h4').textContent).toBe(`Let's "begin" <now>`);
      expect(el.querySelector('strong').textContent).toBe('timeline picker');
    } finally {
      Object.assign(step, original);
    }
  });
});
