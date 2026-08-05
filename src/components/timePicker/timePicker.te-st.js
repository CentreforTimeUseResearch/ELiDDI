import { describe, it, expect, beforeEach } from 'vitest';
import { ActivityPanel } from './timePicker.js';

describe('Activity Panel', () => {
  beforeEach(() => {
    if (!customElements.get('activity-panel')) {
      customElements.define('activity-panel', ActivityPanel);
    }
    document.body.innerHTML = '';
  });

  it('renders activity panel html', () => {
    const el = document.createElement('activity-panel');
    document.body.appendChild(el);
    expect(el.outerHTML).toContain('<activity-panel>');
  });

  // more tests to come
});
