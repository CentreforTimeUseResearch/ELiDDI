// Lets a parent component pass complex values (objects, arrays, callback
// functions) down to a child that's about to be rendered into an HTML
// template string, which can otherwise only carry primitive attribute
// values. The parent calls setProps(...) while building its template and
// embeds the returned string as an attribute; the child looks itself up
// via getProps(key) once connected (see TinyBase.connectedCallback).

const props = {};

function createUUID() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 12).padStart(12, 0);
}

export function getProps(key) {
  return props[key];
}

// `owner` is the component instance whose functions in newProps get bound
// to it, so a callback runs with the right `this` no matter who ends up
// invoking it (e.g. a grandchild component holding the reference).
export function setProps(owner, newProps, returnKey = false) {
  // check props type
  if (
    !(
      newProps === Object(newProps) && Object.prototype.toString.call(newProps) !== '[object Array]'
    )
  ) {
    console.log('newProps must be a js object of {key:value} structure');
    return;
  }

  // automatically bind the functions
  Object.keys(newProps).forEach((prop) => {
    if (typeof newProps[prop] === 'function') {
      newProps[prop] = newProps[prop].bind(owner);
    }
  });

  const uuid = createUUID();
  props[uuid] = newProps;

  if (returnKey) {
    return uuid;
  }

  return `key = ${uuid}`;
}

export function deleteProps(key) {
  delete props[key];
}
