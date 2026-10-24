// Lets a parent component pass complex values (objects, arrays, callback
// functions) down to a child that's about to be rendered into an HTML
// template string, which can otherwise only carry primitive attribute
// values. The parent calls setProps(...) while building its template and
// embeds the returned key="..." attribute; the child looks itself up via
// getProps(key) once connected (see TinyBase.connectedCallback).
//
// Ownership: the component that allocates a key owns it, and is the only
// thing that frees it. TinyBase releases everything a component allocated
// when it renders again (the old markup is being replaced) and when it
// disconnects. A child never deletes the key it was given, so:
//   - markup built but never mounted is still freed, by its owner
//   - a child that is disconnected and reconnected (a DOM move) keeps its
//     props: it resolves them once, on first connect, and holds on to them
//   - a child must not rely on getProps(key) after its owner has
//     re-rendered or disconnected - by then the key no longer resolves

// key -> { owner, props }
const registry = new Map();

export function getProps(key) {
  return registry.get(key)?.props;
}

// `owner` is the component instance whose functions in newProps get bound
// to it, so a callback runs with the right `this` no matter who ends up
// invoking it (e.g. a grandchild component holding the reference).
// newProps is left untouched; the registry stores a bound copy.
export function setProps(owner, newProps, returnKey = false) {
  if (newProps === null || typeof newProps !== 'object' || Array.isArray(newProps)) {
    throw new TypeError('setProps expects a plain object of { key: value } props');
  }

  const props = Object.fromEntries(
    Object.entries(newProps).map(([name, value]) => [
      name,
      typeof value === 'function' ? value.bind(owner) : value,
    ])
  );

  const key = crypto.randomUUID();
  registry.set(key, { owner, props });

  return returnKey ? key : `key="${key}"`;
}

export function releaseAllOwnedBy(owner) {
  registry.forEach((entry, key) => {
    if (entry.owner === owner) {
      registry.delete(key);
    }
  });
}

// how many keys are currently allocated - for tests and leak checks
export function countProps() {
  return registry.size;
}
