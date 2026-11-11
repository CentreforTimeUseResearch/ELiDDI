import { DIARY_STATUS } from '../store/diaryStatus';
import { t } from '../i18n/i18n';

// a Diary's progress: nothing entered yet, some entered, or submitted. Said
// with the date in the nav bar (for screen readers) and shown beside each day
// in the date picker
export function getDayStatus(diary) {
  if (diary?.status === DIARY_STATUS.COMPLETE) {
    return t('navbar.status.complete');
  }
  const started = diary?.timelines?.some(
    (timeline) => Array.isArray(timeline) && timeline.length > 0
  );
  return started ? t('navbar.status.inProgress') : t('navbar.status.notStarted');
}
