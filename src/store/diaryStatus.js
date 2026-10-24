// A Diary is either still being filled in or has been completed (see
// CONTEXT.md's "Diary status"). IN_PROGRESS is 0 because that is the value
// every Diary persisted before these constants existed already carries -
// nothing dispatched a status action in production until now, so no
// persisted Diary holds anything else.
export const DIARY_STATUS = Object.freeze({
  IN_PROGRESS: 0,
  COMPLETE: 100,
});
