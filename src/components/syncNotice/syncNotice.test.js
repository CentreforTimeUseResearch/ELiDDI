import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { requestLogout, logoutAnyway } = vi.hoisted(() => ({
  requestLogout: vi.fn(),
  logoutAnyway: vi.fn(),
}));
vi.mock('../../sync/appSync', () => ({ requestLogout, logoutAnyway }));

import './syncNotice';
import { describeDate } from './syncNotice';
import { appSyncStatus } from '../../sync/syncStatus';

let element;
beforeEach(() => {
  element = document.createElement('el-sync-notice');
  document.body.appendChild(element);
});
afterEach(() => {
  appSyncStatus.dismissNotice();
  element.remove();
  vi.clearAllMocks();
});

describe('describeDate', () => {
  it('writes a date key out in words', () => {
    expect(describeDate('2026-11-03')).toMatch(/3.*2026/);
  });

  it('leaves something that is not a date as it is', () => {
    expect(describeDate('not-a-date')).toBe('not-a-date');
  });
});

describe('<el-sync-notice>', () => {
  it('shows nothing when there is no notice', () => {
    expect(element.hidden).toBe(true);
    expect(element.textContent.trim()).toBe('');
  });

  it('says in words that another device had a newer version of a day, and that the earlier one is kept', () => {
    appSyncStatus.setNotice({ kind: 'replaced', dates: ['2026-11-03'] });

    expect(element.hidden).toBe(false);
    expect(element.textContent).toMatch(/Another device had a newer version of/);
    expect(element.textContent).toMatch(/that day now shows the newer version/);
    expect(element.textContent).toMatch(/earlier version is kept on this device/);
    expect(element.querySelector('[role="status"]')).not.toBeNull();
  });

  it('uses plural wording and lists several days', () => {
    appSyncStatus.setNotice({ kind: 'replaced', dates: ['2026-11-03', '2026-11-04'] });

    expect(element.textContent).toMatch(/those days now show the newer versions/);
    expect(element.textContent).toMatch(/ and /);
  });

  it('goes away when the Respondent presses OK', () => {
    appSyncStatus.setNotice({ kind: 'replaced', dates: ['2026-11-03'] });

    element.querySelector('[data-notice="dismiss"]').click();

    expect(appSyncStatus.getNotice()).toBeNull();
    expect(element.hidden).toBe(true);
  });

  describe('when changes could not be sent at logout', () => {
    beforeEach(() => appSyncStatus.setNotice({ kind: 'unsent' }));

    it('explains, as an alert, what happens to the changes', () => {
      expect(element.querySelector('[role="alert"]')).not.toBeNull();
      expect(element.textContent).toMatch(/stay on this device/);
      expect(element.textContent).toMatch(/next time you log in/);
    });

    it('offers to try again, which asks to log out again', () => {
      element.querySelector('[data-notice="retry"]').click();

      expect(requestLogout).toHaveBeenCalledTimes(1);
      expect(logoutAnyway).not.toHaveBeenCalled();
    });

    it('offers to log out anyway', () => {
      element.querySelector('[data-notice="logout"]').click();

      expect(logoutAnyway).toHaveBeenCalledTimes(1);
    });

    it('offers to stay logged in, which logs nobody out', () => {
      element.querySelector('[data-notice="dismiss"]').click();

      expect(appSyncStatus.getNotice()).toBeNull();
      expect(requestLogout).not.toHaveBeenCalled();
      expect(logoutAnyway).not.toHaveBeenCalled();
    });
  });
});
