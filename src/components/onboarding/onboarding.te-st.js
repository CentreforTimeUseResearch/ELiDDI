import { describe, it, expect, beforeEach } from 'vitest';
import { Onboarding } from './onboarding';

describe('Onboarding', () => {
  beforeEach(() => {
    if (!customElements.get('el-onboarding')) {
      customElements.define('el-onboarding', Onboarding);
    }
    document.body.innerHTML = '';
  });
});
