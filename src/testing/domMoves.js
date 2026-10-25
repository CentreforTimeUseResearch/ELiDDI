// Test helpers for #163: moving a mounted component to a new parent runs
// disconnectedCallback then connectedCallback on it and every descendant.

// moves `element` into a fresh <div> appended to the body
export function moveToNewParent(element) {
  const newParent = document.createElement('div');
  document.body.appendChild(newParent);
  newParent.appendChild(element);
  return newParent;
}

// runs `action`, returning the messages of any errors it reported - errors
// thrown inside connected/disconnected callbacks don't propagate to the
// caller, they're reported on window instead
export function errorsDuring(action) {
  const errors = [];
  const onError = (event) => {
    errors.push(event.error?.message ?? event.message);
    event.preventDefault();
  };
  window.addEventListener('error', onError);
  try {
    action();
  } finally {
    window.removeEventListener('error', onError);
  }
  return errors;
}
