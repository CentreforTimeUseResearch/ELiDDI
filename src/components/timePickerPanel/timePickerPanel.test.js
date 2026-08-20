import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimePickerPanel } from './timePickerPanel';
import { TinyBase } from '../base';

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
});
