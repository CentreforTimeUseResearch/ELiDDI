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

  // The no-JS form (scripts/lib/generateNoJs.js) - the progressive-enhancement
  // baseline, built at deploy time in the study's language
  'noJs.heading': 'Time use diary',
  'noJs.submit': 'Diary Complete',
  'noJs.progress': 'Diary progress: {chunk} of {total}',
  'noJs.notAnswered': 'Not answered',
  'noJs.markAll': 'Mark all relevant boxes',
  'noJs.continueUntilNext':
    'Continue this activity until next entry (if checked you can leave the between entries blank)',
  'noJs.nav.slot': '{timeSlot} time slot navigation',
  'noJs.nav.backHour': 'Skip backwards one hour',
  'noJs.nav.backTenMinutes': 'Skip backwards ten minutes',
  'noJs.nav.forwardTenMinutes': 'Skip forward ten minutes',
  'noJs.nav.forwardHour': 'Skip forward one hour',
  'noJs.nav.chunks': 'Jump to time chunk',
  'noJs.nav.backThreeHours': 'Skip backwards three hours',
  'noJs.nav.forwardThreeHours': 'Skip forward three hours',

  // Timeline names and the keyboard grab announcements (timelineKeyboard.js,
  // grabSession.js). {range} is "04:50 to 05:30"; {arrows} is "Up and Down
  // arrow keys" built from keyboardHelp.key.* names
  'timelineKeyboard.timeline': '{dimension} timeline',
  'timelineKeyboard.timeRange': '{start} to {end}',
  'timelineKeyboard.entryName': '{activity}, {range}, {dimension}',
  'timelineKeyboard.slotName': 'Add entry at {time}, {dimension}',
  'timelineKeyboard.arrowKeys': '{previous} and {next} arrow keys',
  'timelineKeyboard.grabbed':
    'Grabbed {name}, {range}. {arrows} move it. Shift with an arrow key changes its end; Alt and Shift with an arrow key change its start. Enter to confirm, Escape to cancel.',
  'timelineKeyboard.step.now': 'Now {range}.',
  'timelineKeyboard.step.nextStarts': 'The next entry now starts at {time}.',
  'timelineKeyboard.step.previousEnds': 'The previous entry now ends at {time}.',
  'timelineKeyboard.step.limit': 'Limit reached: {reason}.',
  'timelineKeyboard.theEntry': 'The entry',
  'timelineKeyboard.noChange': 'No change. {name} stays at {range}.',
  'timelineKeyboard.done': 'Done. {name} is now {range}.',
  'timelineKeyboard.cancelled': 'Cancelled. {name} is back at {range}.',
  'grabSession.limit.startOfDay': 'start of the day',
  'grabSession.limit.endOfDay': 'end of the day',
  'grabSession.limit.now': "can't go past now",
  'grabSession.limit.neighbourMin':
    "the neighbouring entry can't be shorter than {minutes} minutes",
  'grabSession.limit.entryMin': 'an entry must last at least {minutes} minutes',

  // on-screen feedback while dragging / creating; {text} is a time range
  'timeline.withLimit': '{text} · limit',
  'createPreview.noRoom': 'No room here',
  'entryCommands.overlap':
    'This overlaps with your existing "{activity}" entry ({start}–{end}). Adjust the time, or edit/delete that entry first.',

  'horizontalTimelineAxis.zoomIn': 'Zoom in',
  'horizontalTimelineAxis.zoomOut': 'Zoom out',
  'horizontalTimelineAxis.zoom': 'Zoom {percent}%',
  'horizontalTimelineAxis.zoomClosest': 'Zoom {percent}%, the closest view',
  'horizontalTimelineAxis.zoomWholeDay': 'Zoom {percent}%, the whole day is showing',
  'horizontalTimelineStack.dimensions': 'Dimensions',
  'timelinePicker.label': 'Dimension',

  'login.failure.empty': 'Enter your login code.',
  'login.failure.invalid': 'That code was not recognised. Check it and try again.',
  'login.failure.rateLimited.one': 'Too many attempts. Please wait {minutes} minute and try again.',
  'login.failure.rateLimited.other':
    'Too many attempts. Please wait {minutes} minutes and try again.',
  'login.failure.rateLimited.unknown':
    'Too many attempts. Please wait a few minutes and try again.',
  'login.failure.network': 'Could not reach the server. Check your connection and try again.',
  'login.failure.server': 'Something went wrong on the server. Please try again later.',

  // the checks (src/validation/rules); {from}/{to} are clock times
  'validation.noGaps.title': 'No gaps in Primary activity',
  'validation.noGaps.none': 'No Primary activity has been recorded.',
  'validation.noGaps.missing': 'Primary activity is missing from {from} to {to}.',
  'validation.noGaps.missingMore.one':
    'Primary activity is missing from {from} to {to} (and {more} more gap).',
  'validation.noGaps.missingMore.other':
    'Primary activity is missing from {from} to {to} (and {more} more gaps).',
  'validation.differ.title': 'Primary and Secondary activity differ',
  'validation.differ.message':
    '"{activity}" is recorded as both Primary and Secondary activity from {from} to {to}.',
  'validation.sleep.title': 'At least {hours} hours of sleep',
  'validation.sleep.message': '{recorded} of sleep recorded (less than {minimum}).',
  'validation.duration.hours': '{hours}h',
  'validation.duration.minutes': '{minutes}m',
  'validation.duration.hoursMinutes': '{hours}h {minutes}m',
  'validation.eating.title': 'Eating or drinking recorded',
  'validation.eating.message': 'No eating or drinking recorded.',

  'validationPanel.title': 'Checks',
  'validationPanel.close': 'Close checks',
  'validationPanel.empty': 'No checks are set for this study.',
  'validationPanel.passed': 'passed',
  'validationPanel.failed': 'failed',
  'validationPanel.advice': '(advice)',
  'validationPanel.hint':
    'The checks that are not marked as advice must pass before you can complete this Diary.',
  'validationPanel.complete': 'Diary complete',
  'validationPanel.sending': 'Sending…',
  'validationPanel.submitted': 'This Diary has been submitted. Thank you.',
  'validationPanel.confirm.title': 'Are you sure?',
  'validationPanel.confirm.intro': 'These checks are not met:',
  'validationPanel.confirm.submitAnyway': 'Submit anyway',
  'validationPanel.confirm.goBack': 'Go back',
  'validationPanel.failure.unauthorized':
    'Your login has run out. Log in again, then press Diary complete again. Your Diary has not been lost.',
  'validationPanel.failure.network':
    'The Diary could not be sent. Check your connection and try again.',
  'validationPanel.failure.http':
    'The server could not accept the Diary (error {status}). Try again in a moment.',
  'validationPanel.failure.noDiary': 'There is no Diary to send yet.',

  // joins a list of names: "a and b", "a, b and c" (ADR 0008: no plural/list
  // engine - the pieces are keys, the joining logic stays in the caller)
  'common.listAnd': ' and ',
  'common.listSeparator': ', ',

  'dialog.close': 'close',
  'dialog.skip': 'skip',
  'dialog.cancel': 'cancel',
  'resetDialog.message': "Clear every entry for the selected day? This can't be undone.",
  'resetDialog.confirm': 'Clear this day',

  // joins sentence fragments ("Choose an activity. An entry must last…")
  'common.sentenceJoin': '. ',

  'datePicker.label': 'Choose date:',

  'detailsPanel.save': 'Save',
  'detailsPanel.delete': 'Delete',
  'detailsPanel.reason.times': 'Choose a start and end time',
  'detailsPanel.reason.activity': 'Choose an activity',
  'detailsPanel.reason.minDuration': 'An entry must last at least {minutes} minutes',

  'deleteConfirm.question': "Delete this entry? This can't be undone.",
  'deleteConfirm.confirm': 'Delete',
  'deleteConfirm.keep': 'Keep it',

  'leavePrompt.question': 'You have unsaved changes to this entry.',
  'leavePrompt.cannotSave': "It can't be saved yet. {reasons}.",
  'leavePrompt.save': 'Save',
  'leavePrompt.discard': 'Discard',
  'leavePrompt.keep': 'Keep editing',

  'activityPicker.done': 'Done',
  'activityPicker.useFreeText': 'Use "{text}"',

  // shared by detailsPanel (the continue target) and timePickerPanel (its checkbox)
  'timePickerPanel.continue.toEnd': 'Continue this activity to the end of the day',
  'timePickerPanel.continue.toNext': 'Continue this activity to the next activity',
  'timePickerPanel.legend': 'Schedule Settings',
  'timePickerPanel.startLabel': 'Start time (24-hour format)',
  'timePickerPanel.endLabel': 'End time (24-hour format)',
  'timePickerPanel.durationLabel': 'Duration',
  'timePickerPanel.endBetween': "End time can't be between {from} and {to}",
  'timePickerPanel.endTooSoon': 'End time must be at least {minutes} minutes after the start time',

  'timePicker.placeholder': 'HH:MM',
  'timePicker.hint': 'Format: HH:MM (e.g., 14:30)',
  'timePicker.required': 'The {label} time field is required.',
  'timePicker.invalid': 'Please enter a valid 24-hour time between 00:00 and 23:59.',
  'timePicker.future': 'Time cannot be in the future. Please select a time at or before {max}.',

  'durationInput.hint': 'For example, 1 hour and 30 minutes',
  'durationInput.hours': 'Hours',
  'durationInput.minutes': 'Minutes',
  'durationInput.hoursInvalid': 'Enter hours as a number between 0 and {max}.',
  'durationInput.minutesInvalid': 'Enter minutes as a number between 0 and {max}.',

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

  'submissionStatus.name.noRules': 'Diary checks',
  'submissionStatus.name.ready': 'Diary checks: ready to submit',
  'submissionStatus.name.notReady': 'Diary checks: not ready',

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
  'keyboardHelp.key.left': 'Left',
  'keyboardHelp.key.right': 'Right',
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
