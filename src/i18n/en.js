// The reference catalogue (docs/adr/0008-ui-strings-from-a-message-catalogue.md).
// Flat dotted keys, namespaced by component; `{name}` placeholders are filled
// by t()'s params argument. Every user-facing string belongs here - a literal
// in a component is a review flag. A new language is a copy of this file,
// translated, registered in i18n.js; keys it leaves out fall back to these.
export default {
  'login.title': 'Log in',
  'login.codeLabel': 'Login code',
  'login.codeHint':
    '8 letters and numbers, like ABCD-EFGH. Capital letters and the hyphen are optional.',
  'login.submit': 'Log in',
  'login.submitting': 'Logging in…',
  'login.notice.logout': 'You have logged out.',
  'login.notice.expired': 'Your session has ended. Please log in again.',
  'login.gate.loading': 'Loading your diary…',
  'login.gate.loadFailed': 'Your diary could not be loaded. Check your connection and try again.',
  'login.gate.retry': 'Try again',
  'login.gate.outdated':
    'This page is out of date and cannot open your diary safely. Reload the page to continue.',
  'login.gate.reload': 'Reload the page',
  'login.gate.logout': 'Log out',
};
