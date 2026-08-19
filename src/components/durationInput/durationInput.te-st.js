import { describe, it, expect, beforeEach } from 'vitest';
import { DurationInput } from './durationInput';

describe('DurationInput', () => {
  beforeEach(() => {
    if (!customElements.get('el-duration-input')) {
      customElements.define('el-duration-input', DurationInput);
    }
    document.body.innerHTML = '';
  });
});
