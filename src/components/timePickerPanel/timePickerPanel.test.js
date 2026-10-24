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

  function createPanel(props = {}, dayBoundaryInMinutes = '240') {
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
    el.setAttribute('day-boundary', dayBoundaryInMinutes);
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

  // regression test for a bug where reopening a saved entry (which sets
  // start-time/end-time via HTML attributes - always strings, unlike a
  // typed/checkbox-computed value, which arrives as a number) showed a
  // wildly wrong duration. `"1679" < "840"` is true under JS's *string*
  // comparison (lexicographic: '1' < '8'), so the "wrapped past midnight"
  // branch wrongly fired, and += on a string concatenates instead of
  // adding, producing a garbage total. Reproduced for any start before
  // 16:40 (raw minutes < 1000, i.e. still a 3-digit string) paired with a
  // 4-digit end, e.g. end-of-day (1679) via "continue to end of day".
  it('computes the correct duration when start/end times arrive as attribute strings, not numbers', () => {
    const el = createPanel();

    el.setAttribute('start-time', '840'); // 14:00
    el.setAttribute('end-time', '1679'); // 03:59 next day (end of day)

    expect(el.durationInputMinutes).toBe(839); // 13h59m, not 16790600
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

  // every attribute in the panel's subtree whose value contains "undefined"
  function undefinedAttributes(el) {
    return [el, ...el.querySelectorAll('*')].flatMap((node) =>
      [...node.attributes]
        .filter((attr) => attr.value.includes('undefined'))
        .map((attr) => `${node.tagName.toLowerCase()}[${attr.name}="${attr.value}"]`)
    );
  }

  const valueOf = (el, inputId) =>
    el.querySelector(`[input-id="${inputId}"]`).getAttribute('value');

  // regression coverage (#145): times were tested for truthiness, so a
  // legitimate 0 - 00:00, the first minute of a study whose day boundary is
  // midnight - counted as "not set"
  describe('a time of 0 (00:00 under a midnight day boundary)', () => {
    it('shows a 00:00 start time, and computes the duration from it', () => {
      const el = createPanel({}, '0');

      el.onTimeInputChange('startTime', 0);
      el.onTimeInputChange('endTime', 60);

      expect(valueOf(el, 'startTime')).toBe('00:00');
      expect(el.durationInputMinutes).toBe(60);
      expect(valueOf(el, 'duration')).toBe('60');
    });

    it('computes the end time from a duration after a 00:00 start', () => {
      const onTimeSet = vi.fn();
      const el = createPanel({ onTimeSet }, '0');

      el.onTimeInputChange('startTime', 0);
      el.onTimeInputChange('duration', 30);

      expect(el.endInputMinutes).toBe(30);
      expect(onTimeSet).toHaveBeenCalledWith({ timeField: 'endTime', timeInMinutes: 30 });
    });

    it('labels "continue to…" from a 00:00 start', () => {
      const getContinueToTarget = vi.fn(() => ({
        endTimeInMinutes: 60,
        label: 'Continue to 01:00',
      }));
      const el = createPanel({ getContinueToTarget }, '0');

      el.onTimeInputChange('startTime', 0);

      expect(getContinueToTarget).toHaveBeenCalledWith(0);
      expect(el.querySelector('label[for="timepicker-rest-of-day"]').textContent).toBe(
        'Continue to 01:00'
      );
    });

    it('computes the duration when the end time is midnight (0) and was set first', () => {
      const el = createPanel(); // 04:00 day boundary

      el.onTimeInputChange('endTime', 0); // 00:00
      el.onTimeInputChange('startTime', 1380); // 23:00

      expect(el.durationInputMinutes).toBe(60);
    });
  });

  // regression coverage (#145): a zero duration was blanked as if unset
  it('shows a duration of 0 as 0 hours and 0 minutes, not as blank', () => {
    const el = createPanel();

    el.onTimeInputChange('startTime', 480);
    el.onTimeInputChange('endTime', 480);

    expect(el.durationInputMinutes).toBe(0);
    expect(valueOf(el, 'duration')).toBe('0');
    expect(el.querySelector('#duration-hours').value).toBe('0');
    expect(el.querySelector('#duration-minutes').value).toBe('0');
  });

  // regression coverage (#145): an unset time was written as the literal
  // attribute value "undefined", both by the template and by setAttribute
  describe('never renders an attribute containing "undefined"', () => {
    it('on first render, with no times set', () => {
      expect(undefinedAttributes(createPanel())).toEqual([]);
    });

    it('after only a start time is set, and after re-rendering', () => {
      const el = createPanel();
      el.onTimeInputChange('startTime', 480);
      expect(undefinedAttributes(el)).toEqual([]);

      el.render();
      expect(undefinedAttributes(el)).toEqual([]);
    });

    it('leaves an unset time empty in its input', () => {
      const el = createPanel();
      el.onTimeInputChange('startTime', 480);

      expect(el.querySelector('[data-id="endTime"]').value).toBe('');
      expect(el.querySelector('#duration-hours').value).toBe('');
    });
  });

  // regression coverage (#145): the end-time message was rendered into an
  // attribute TimePicker never read, was only refreshed on a full
  // re-render, and was never cleared once set
  describe('the end-time error', () => {
    const endError = (el) => el.querySelector('[data-id="endTime-time-error"]');

    it('shows when the end time falls past the end of the diary day, and clears once it is valid', () => {
      const el = createPanel();
      el.onTimeInputChange('startTime', 600); // 10:00
      el.onTimeInputChange('endTime', 300); // 05:00 next day - past the 04:00 boundary

      expect(endError(el).textContent).toMatch(/^End time can't be between 04:00 and 10:00$/);
      expect(endError(el).hidden).toBe(false);

      el.onTimeInputChange('endTime', 660); // 11:00

      expect(endError(el).textContent).toBe('');
      expect(endError(el).hidden).toBe(true);
    });

    it('keeps the whole message as one attribute value through a re-render', () => {
      const el = createPanel();
      el.onTimeInputChange('startTime', 600);
      el.onTimeInputChange('endTime', 300);

      el.render();

      const endPicker = el.querySelector('[input-id="endTime"]');
      expect(endPicker.getAttribute('error')).toBe("End time can't be between 04:00 and 10:00");
      expect(endPicker.hasAttribute('between')).toBe(false);
    });
  });
});
