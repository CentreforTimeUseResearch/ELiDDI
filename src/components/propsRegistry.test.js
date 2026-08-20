import { describe, it, expect, vi } from 'vitest';
import { getProps, setProps, deleteProps } from './propsRegistry';

describe('propsRegistry', () => {
  it('stores props under a generated key and returns them via getProps', () => {
    const key = setProps({}, { content: [1, 2, 3] }, true);

    expect(getProps(key)).toEqual({ content: [1, 2, 3] });
  });

  it('returns a "key = <uuid>" string by default (for embedding directly as an HTML attribute)', () => {
    const result = setProps({}, { content: [] });

    expect(result).toMatch(/^key = \S+$/);
    const key = result.replace('key = ', '');
    expect(getProps(key)).toEqual({ content: [] });
  });

  it('binds function props to the given owner', () => {
    const owner = { name: 'owner' };
    const callback = vi.fn(function () {
      return this;
    });

    const key = setProps(owner, { onClick: callback }, true);
    const boundCallback = getProps(key).onClick;

    expect(boundCallback()).toBe(owner);
  });

  it('rejects a non-plain-object props argument without throwing', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = setProps({}, [1, 2, 3], true);

    expect(result).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('removes props on deleteProps so a stale key no longer resolves', () => {
    const key = setProps({}, { content: 'x' }, true);
    expect(getProps(key)).toBeDefined();

    deleteProps(key);

    expect(getProps(key)).toBeUndefined();
  });
});
