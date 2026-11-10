// A polite live region for things that change without moving focus, so a
// screen reader says them: a different day is showing, the zoom changed. One
// visually hidden element for the whole page (WCAG 4.1.3 Status Messages).
// What is said is also visible somewhere else in the interface; this is only
// the part a screen reader would otherwise miss.
//
// A live region is only announced reliably if it already exists when its text
// changes, so ensureAnnouncer() is called as the interface starts, and
// announce() would make it on first use if it had not been.

// built, not typed, so no editor or formatter turns it into a plain space
const NO_BREAK_SPACE = String.fromCharCode(0xa0);

let region;
let alternate = false;

export function ensureAnnouncer() {
  if (!region?.isConnected) {
    region = document.createElement('div');
    region.className = 'sr-only announcer';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    document.body.appendChild(region);
  }
  return region;
}

// says `text`. The same words twice in a row would not change the region, so
// are told apart by a trailing no-break space that comes and goes.
export function announce(text) {
  const live = ensureAnnouncer();
  alternate = !alternate;
  live.textContent = alternate ? text : text + NO_BREAK_SPACE;
}
