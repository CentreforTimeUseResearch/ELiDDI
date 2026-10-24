import { describe, it, expect, vi } from 'vitest';
import { getProps, setProps, releaseAllOwnedBy, countProps } from './propsRegistry';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('propsRegistry', () => {
  it('stores props under a generated key and returns them via getProps', () => {
    const key = setProps({}, { content: [1, 2, 3] }, true);

    expect(getProps(key)).toEqual({ content: [1, 2, 3] });
  });

  it('returns a quoted key="<uuid>" attribute by default, for embedding in a template', () => {
    const result = setProps({}, { content: [] });

    expect(result).toMatch(/^key="[^"]+"$/);
    const key = result.slice('key="'.length, -1);
    expect(getProps(key)).toEqual({ content: [] });
  });

  it('generates keys with crypto.randomUUID()', () => {
    expect(setProps({}, {}, true)).toMatch(UUID);
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

  // regression coverage (#140): functions were rebound in place on the
  // caller's object, so reusing an object re-bound already-bound functions
  it('does not mutate the object passed to it', () => {
    const onClick = function () {};
    const newProps = Object.freeze({ onClick, content: 'x' });

    const key = setProps({}, newProps, true);

    expect(newProps.onClick).toBe(onClick);
    expect(getProps(key)).not.toBe(newProps);
    expect(getProps(key).content).toBe('x');
  });

  // regression coverage (#140): a non-object was logged and undefined
  // returned, which a template embeds as the literal attribute "undefined"
  it.each([
    ['an array', [1, 2, 3]],
    ['null', null],
    ['a string', 'content'],
    ['undefined', undefined],
  ])('throws a TypeError for %s', (_, value) => {
    expect(() => setProps({}, value)).toThrow(TypeError);
  });

  it('releases every key an owner allocated, and only those', () => {
    const owner = {};
    const other = {};
    const before = countProps();
    const ownedA = setProps(owner, { a: 1 }, true);
    const ownedB = setProps(owner, { b: 2 }, true);
    const othersKey = setProps(other, { c: 3 }, true);

    releaseAllOwnedBy(owner);

    expect(getProps(ownedA)).toBeUndefined();
    expect(getProps(ownedB)).toBeUndefined();
    expect(getProps(othersKey)).toEqual({ c: 3 });
    expect(countProps()).toBe(before + 1);
    releaseAllOwnedBy(other);
  });
});
