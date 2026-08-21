import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimePickerPanel } from './timePickerPanel';
import { TinyBase } from '../base';
import { appStore } from '../../store/appStore';
import { SWITCH_DATE } from '../../store/actionTypes';
import { getCurrentDiaryDateKey } from '../../utils/time';

class TestHarness extends TinyBase {}
if (!customElements.get('test-harness-timepickerpanel')) {
  customElements.define('test-harness-timepickerpanel', TestHarness);
}

describe('TimePickerPanel', () => {
  beforeEach(() => {
    if (!customElements.get('el-time-picker-panel')) {
      customElements.define('el-time-picker-panel', TimePickerPanel);
    }
    document.body.innerHTML = '';
  });

  function createPanel(props = {}) {
    const harness = document.createElement('test-harness-timepickerpanel');
    const key = harness.setProps(
      {
        onTimeSet: vi.fn(),
        getContinueToTarget: vi.fn(() => ({
          endTimeInMinutes: 0,
          label: 'Continue this activity to the end of the day',
        })),
        ...props,
      },
      true
    );
    const el = document.createElement('el-time-picker-panel');
    el.setAttribute('key', key);
    el.setAttribute('day-boundary', '240');
    document.body.appendChild(el);
    return el;
  }

  it('renders start time, end time, and duration inputs', () => {
    const el = createPanel();
    expect(el.querySelector('[input-id="startTime"]')).not.toBeNull();
    expect(el.querySelector('[input-id="endTime"]')).not.toBeNull();
    expect(el.querySelector('[input-id="duration"]')).not.toBeNull();
  });

  // regression test for a bug where setting a duration computed and displayed
  // an end time but never reported it via onTimeSet, so callers relying on
  // that callback (e.g. DetailsPanel's save-button state) never found out
  it('reports the computed end time via onTimeSet when duration is set after start time', () => {
    const onTimeSet = vi.fn();
    const el = createPanel({ onTimeSet });

    el.onTimeInputChange('startTime', 480); // 08:00
    onTimeSet.mockClear();
    el.onTimeInputChange('duration', 90); // 1h30

    expect(el.endInputMinutes).toBe(570); // 09:30
    expect(onTimeSet).toHaveBeenCalledWith({ timeField: 'endTime', timeInMinutes: 570 });
  });

  // regression coverage for the future-time-validation multi-day bug: the
  // max editable time used to be computed from raw wall-clock "now" with
  // no awareness of which diary date was being edited.
  describe('getMaxEditableTime', () => {
    it('returns a defined max when editing the actual current diary day', () => {
      appStore.dispatch({ type: SWITCH_DATE, payload: getCurrentDiaryDateKey() });
      const el = createPanel();

      expect(el.getMaxEditableTime()).toMatch(/^\d{2}:\d{2}$/);
    });

    it('returns undefined (no constraint) when editing a past diary day', () => {
      appStore.dispatch({ type: SWITCH_DATE, payload: '2000-01-01' });
      const el = createPanel();

      expect(el.getMaxEditableTime()).toBeUndefined();
    });
  });

  // regression test: convertMinutesToTimePickerFormat used to render exactly
  // midnight (1440 in its raw "minutes past day-boundary, extended past
  // 1440" format) as "24:00" instead of "00:00" - reachable both from an
  // entry starting exactly at midnight and, now, from the max-editable-time
  // computation when "now" is exactly midnight.
  it('formats exactly midnight (1440) as "00:00", not "24:00"', () => {
    const el = createPanel();
    expect(el.convertMinutesToTimePickerFormat(1440)).toBe('00:00');
  });
});
