import { describe, it, expect } from 'vitest';
import { GrabSession } from './grabSession';

const entry = (id, startOffsetMins, endOffsetMins) => ({
  id,
  startOffsetMins,
  endOffsetMins,
  activity: `entry ${id}`,
});

// A 0-60, B 60-100 (grabbed), C 100-160, D 200-260
const entries = [entry(1, 0, 60), entry(2, 60, 100), entry(3, 100, 160), entry(4, 200, 260)];

const session = (overrides = {}) =>
  new GrabSession({
    entries,
    entryId: 2,
    singleChoice: true,
    nowLimitMins: 1440,
    ...overrides,
  });

describe('GrabSession', () => {
  it('starts with nothing changed', () => {
    const grab = session();

    expect(grab.outcome().changed).toBe(false);
    expect(grab.changedEntries()).toEqual([]);
    expect(grab.initialSpan).toEqual({ start: 60, end: 100 });
  });

  it('moves, reporting what it did to the neighbours', () => {
    const grab = session();

    const step = grab.step('move', 30);

    expect([step.startOffsetMins, step.endOffsetMins]).toEqual([90, 130]);
    expect(step.neighbours).toEqual([
      { id: 1, startOffsetMins: 0, endOffsetMins: 60, startMoved: false, endMoved: false },
      { id: 3, startOffsetMins: 130, endOffsetMins: 160, startMoved: true, endMoved: false },
    ]);
  });

  it('is reversible within one kind of step', () => {
    const grab = session();

    grab.step('move', 30);
    grab.step('move', -30);

    expect(grab.changedEntries()).toEqual([]);
    expect(grab.outcome().changed).toBe(false);
  });

  it('builds on what the last kind of step left when the kind changes', () => {
    const grab = session();

    grab.step('move', 10); // B 70-110, C 110-160
    const step = grab.step('end', 10); // C now touches B's end

    expect([step.startOffsetMins, step.endOffsetMins]).toEqual([70, 120]);
    expect(grab.outcome()).toEqual({
      changed: true,
      span: { startOffsetMins: 70, endOffsetMins: 120 },
      neighbourChanges: [{ entryId: 3, startOffsetMins: 120, endOffsetMins: 160 }],
    });
  });

  it('reports every Entry that ended up different, however many steps it took', () => {
    const grab = session();

    grab.step('move', -50); // B 10-50, A 0-10
    grab.step('end', 10); // B 10-60

    expect(grab.changedEntries()).toEqual([
      { id: 1, startOffsetMins: 0, endOffsetMins: 10 },
      { id: 2, startOffsetMins: 10, endOffsetMins: 60 },
    ]);
  });

  it('says which limit held a step back', () => {
    expect(session().step('move', -Infinity).reason).toBe(
      "the neighbouring entry can't be shorter than 10 minutes"
    );
    expect(session().step('end', -Infinity).reason).toBe('an entry must last at least 10 minutes');
    const first = new GrabSession({
      entries: [entry(1, 0, 40)],
      entryId: 1,
      singleChoice: true,
      nowLimitMins: 1440,
    });
    expect(first.step('move', -10).reason).toBe('start of the day');
    const last = new GrabSession({
      entries: [entry(1, 1400, 1440)],
      entryId: 1,
      singleChoice: true,
      nowLimitMins: 1440,
    });
    expect(last.step('move', 10).reason).toBe('end of the day');
    const today = new GrabSession({
      entries: [entry(1, 400, 440)],
      entryId: 1,
      singleChoice: true,
      nowLimitMins: 460,
    });
    expect(today.step('move', 60).reason).toBe("can't go past now");
  });

  it('has no reason when nothing held it back', () => {
    const step = session().step('move', -10);

    expect(step.atLimit).toBe(false);
    expect(step.reason).toBeUndefined();
  });

  it('draws the grabbed Entry and the neighbours it is working on, even when restored', () => {
    const grab = session();

    grab.step('move', 30);
    grab.step('move', -30);

    expect(grab.previewEntries().map((e) => e.id)).toEqual([1, 2, 3]);
    expect(grab.previewEntries().find((e) => e.id === 3)).toEqual({
      id: 3,
      startOffsetMins: 100,
      endOffsetMins: 160,
    });
  });

  it('does not touch other Entries on a multiple-choice Dimension', () => {
    const grab = session({ singleChoice: false });

    const step = grab.step('move', 30);

    expect(step.neighbours).toEqual([]);
    expect(grab.outcome().neighbourChanges).toEqual([]);
  });
});
