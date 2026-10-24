import { describe, it, expect } from 'vitest';
import { escapeHtml } from './html';

describe('escapeHtml', () => {
  it('escapes every character HTML gives meaning to in text and attributes', () => {
    expect(escapeHtml(`<b class='x'>"Tom & Jerry"</b>`)).toBe(
      '&lt;b class=&#39;x&#39;&gt;&quot;Tom &amp; Jerry&quot;&lt;/b&gt;'
    );
  });

  it('escapes an existing entity rather than passing it through', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves ordinary text unchanged', () => {
    expect(escapeHtml('Sleep and personal care')).toBe('Sleep and personal care');
  });

  it('renders a missing value as empty text, and any other value as its string', () => {
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(0)).toBe('0');
  });

  it('round-trips through double- and single-quoted attributes and text exactly', () => {
    const value = `Children's "quiet" time <R&R>`;
    const host = document.createElement('div');
    host.innerHTML = `<button data-value="${escapeHtml(value)}" title='${escapeHtml(value)}'>${escapeHtml(value)}</button>`;
    const button = host.querySelector('button');

    expect(button.dataset.value).toBe(value);
    expect(button.title).toBe(value);
    expect(button.textContent).toBe(value);
    expect(button.attributes).toHaveLength(2);
  });
});
