// keep in sync with --desktop-width in style.css's :root - media queries
// (and matchMedia query strings) can't read CSS custom properties, so this
// is a hand-kept literal, same convention as every `@media (min-width:
// 1024px)` rule elsewhere in the codebase
const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

// Watches the desktop breakpoint and calls onChange(matches) immediately,
// then again on every crossing. matchMediaFn is injectable (defaults to
// window.matchMedia) so a test can supply a fake, controllable
// implementation - necessary because jsdom (this project's test
// environment) does not implement window.matchMedia at all, so a caller
// that didn't guard for that would crash every test that imports it.
// Returns a cleanup function that removes the listener.
export function watchDesktopBreakpoint(onChange, matchMediaFn = window.matchMedia) {
  if (typeof matchMediaFn !== 'function') {
    onChange(false);
    return () => {};
  }
  const mediaQueryList = matchMediaFn(DESKTOP_MEDIA_QUERY);
  onChange(mediaQueryList.matches);
  const listener = (event) => onChange(event.matches);
  mediaQueryList.addEventListener('change', listener);
  return () => mediaQueryList.removeEventListener('change', listener);
}
