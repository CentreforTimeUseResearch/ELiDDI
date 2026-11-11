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

  // joins a list of names: "a and b", "a, b and c" (ADR 0008: no plural/list
  // engine - the pieces are keys, the joining logic stays in the caller)
  'common.listAnd': ' and ',
  'common.listSeparator': ', ',

  'dialog.close': 'close',
  'dialog.skip': 'skip',
  'dialog.cancel': 'cancel',
  'resetDialog.message': "Clear every entry for the selected day? This can't be undone.",
  'resetDialog.confirm': 'Clear this day',

  'datePicker.label': 'Choose date:',

  'onboarding.back': 'back',
  'onboarding.next': 'next',
  'onboarding.start': 'start',
  'onboarding.progress': '{step} of {total}',

  'navbar.menu.instructions': 'Instructions',
  'navbar.menu.shortcuts': 'Keyboard shortcuts',
  'navbar.menu.reset': 'Reset (clears this day)',
  'navbar.menu.stats': 'View stats',
  'navbar.menu.about': 'About this study',
  'navbar.menu.logout': 'Log out (switch person)',
  'navbar.changeDay': 'Change day',
  'navbar.selectedDay': 'Selected day: ',
  'navbar.changeDate': 'change',
  'navbar.today': 'Today',
  'navbar.todayLabel': 'Today, {date}',
  'navbar.previousDayLabel': 'Previous day, {date}',
  'navbar.nextDayLabel': 'Next day, {date}',
  'navbar.nextDayDisabledLabel': 'Next day',
  'navbar.nextDayReason': "You can't fill in days that haven't happened",
  'navbar.todayReason': 'Already showing today',
  'navbar.status.complete': 'Complete',
  'navbar.status.inProgress': 'In progress',
  'navbar.status.notStarted': 'Not started',
  'navbar.announce.complete': 'Showing {day}, diary complete',
  'navbar.announce.progress': 'Showing {day}, {started} of {total} timelines started',

  'contextualHelp.name.noRules': 'Diary checks',
  'contextualHelp.name.ready': 'Diary checks: ready to submit',
  'contextualHelp.name.notReady': 'Diary checks: not ready',

  'syncStatus.saved': 'Saved',
  'syncStatus.saving': 'Saving…',
  'syncStatus.unsaved': 'Not saved yet - will retry',
  'syncStatus.rejected': 'Could not save to the server - your diary is kept on this device',

  // {days} is a list of dates ("3 November 2026 and 4 November 2026")
  'syncNotice.replaced.one':
    'Another device had a newer version of {days}, so that day now shows the newer version. Your earlier version is kept on this device.',
  'syncNotice.replaced.other':
    'Another device had a newer version of {days}, so those days now show the newer versions. Your earlier versions are kept on this device.',
  'syncNotice.ok': 'OK',
  'syncNotice.unsent':
    'Your latest changes could not be sent to the server. If you log out now they stay on this device, and are sent the next time you log in here.',
  'syncNotice.retry': 'Try again',
  'syncNotice.logoutAnyway': 'Log out anyway',
  'syncNotice.stayLoggedIn': 'Stay logged in',

  // The named keys are labelled as keyboards label them; the punctuation keys
  // and "t" are the shortcut itself and stay literal in keyboardHelp.js
  'keyboardHelp.title': 'Keyboard shortcuts',
  'keyboardHelp.intro': 'These work while a timeline has keyboard focus (press Tab to reach one).',
  'keyboardHelp.or': ' or ',
  'keyboardHelp.key.up': 'Up',
  'keyboardHelp.key.down': 'Down',
  'keyboardHelp.key.home': 'Home',
  'keyboardHelp.key.end': 'End',
  'keyboardHelp.key.pageUp': 'Page Up',
  'keyboardHelp.key.pageDown': 'Page Down',
  'keyboardHelp.key.enter': 'Enter',
  'keyboardHelp.key.escape': 'Escape',
  'keyboardHelp.key.space': 'Space',
  'keyboardHelp.key.arrowKeys': 'Arrow keys',
  'keyboardHelp.key.shift': 'Shift',
  'keyboardHelp.key.alt': 'Alt',

  'keyboardHelp.moving.heading': 'Moving around a timeline',
  'keyboardHelp.moving.intro':
    'Press Tab to reach a timeline, then use these keys. A timeline is one Tab stop; the arrow keys move inside it.',
  'keyboardHelp.moving.upDown':
    'the previous or next entry or empty slot (Left and Right on the desktop rows)',
  'keyboardHelp.moving.homeEnd': 'the start or end of the day',
  'keyboardHelp.moving.pageUpDown': 'an hour earlier or later',
  'keyboardHelp.moving.enter':
    'open an entry, or start a new one at an empty slot, and move into the panel',
  'keyboardHelp.moving.escape': 'close the panel and come back to the timeline',

  'keyboardHelp.grab.heading': 'Moving or resizing an entry',
  'keyboardHelp.grab.intro':
    'Press Space on an entry to pick it up. Nothing changes until you confirm, and what is happening is written in the bar at the bottom of the window.',
  'keyboardHelp.grab.space': 'pick up the focused entry',
  'keyboardHelp.grab.arrows': 'move it 10 minutes (along the time axis)',
  'keyboardHelp.grab.shiftArrows': 'move its end',
  'keyboardHelp.grab.altShiftArrows': 'move its start',
  'keyboardHelp.grab.pageUpDown': 'an hour at a time instead of 10 minutes',
  'keyboardHelp.grab.homeEnd': 'as far as it will go',
  'keyboardHelp.grab.confirm': 'confirm',
  'keyboardHelp.grab.cancel': 'cancel and put everything back',

  'keyboardHelp.switching.heading': 'Switching Dimension and day',
  'keyboardHelp.switching.intro':
    'These work while a timeline has focus, and not in text fields or the panel.',
  'keyboardHelp.switching.previousDimension': 'previous Dimension',
  'keyboardHelp.switching.nextDimension': 'next Dimension',
  'keyboardHelp.switching.previousDay': 'previous day',
  'keyboardHelp.switching.nextDay': 'next day (never a day that has not happened)',
  'keyboardHelp.switching.today': 'today',
};
