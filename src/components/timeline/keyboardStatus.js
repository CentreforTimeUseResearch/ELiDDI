// The one visible, announced message for keyboard operations on a Timeline: a
// bar at the bottom of the window. It is a polite status region, so a screen
// reader reads each new message, and the same text is there to read for
// everyone else - the mode and the keys while an Entry is grabbed, then a
// result that stays a few seconds. There is one for the page: only one Entry
// is ever being worked on from the keyboard.

const RESULT_VISIBLE_MS = 5000;

let element;
let clearTimer;

function ensureElement() {
  if (!element?.isConnected) {
    element = document.createElement('div');
    element.className = 'keyboard-status';
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    element.setAttribute('aria-atomic', 'true');
    document.body.appendChild(element);
  }
  return element;
}

// a message while the mode is on (marked active, and kept until it ends)
export function showKeyboardStatus(text) {
  const bar = ensureElement();
  clearTimeout(clearTimer);
  bar.textContent = text;
  bar.classList.add('is-active');
}

// a final message: shown for a few seconds, then cleared
export function endKeyboardStatus(text) {
  const bar = ensureElement();
  clearTimeout(clearTimer);
  bar.classList.remove('is-active');
  bar.textContent = text;
  clearTimer = setTimeout(() => {
    bar.textContent = '';
  }, RESULT_VISIBLE_MS);
}
