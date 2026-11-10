import { describe, it, expect } from 'vitest';
import { computeResize } from './resizeSpan';

const entry = (id, startOffsetMins, endOffsetMins) => ({
  id,
  startOffsetMins,
  endOffsetMins,
  activity: `entry ${id}`,
});

const base = { singleChoice: true, nowLimitMins: 1440 };

describe('computeResize - an Entry on its own', () => {
  const alone = entry(1, 100, 160);
  const entries = [alone];

  it('moves the end edge, leaving the start where it was', () => {
    expect(
      computeResize({
        ...base,
        entry: alone,
        entries,
        edge: 'end',
        requestedOffsetMins: 200,
      })
    ).toEqual({ startOffsetMins: 100, endOffsetMins: 200, atLimit: false, neighbours: [] });
  });

  it('moves the start edge, leaving the end where it was', () => {
    expect(
      computeResize({
        ...base,
        entry: alone,
        entries,
        edge: 'start',
        requestedOffsetMins: 40,
      })
    ).toEqual({ startOffsetMins: 40, endOffsetMins: 160, atLimit: false, neighbours: [] });
  });

  it('keeps the Entry at least 10 minutes long, from either edge', () => {
    const end = computeResize({
      ...base,
      entry: alone,
      entries,
      edge: 'end',
      requestedOffsetMins: 90,
    });
    const start = computeResize({
      ...base,
      entry: alone,
      entries,
      edge: 'start',
      requestedOffsetMins: 500,
    });

    expect([end.startOffsetMins, end.endOffsetMins, end.atLimit]).toEqual([100, 110, true]);
    expect([start.startOffsetMins, start.endOffsetMins, start.atLimit]).toEqual([150, 160, true]);
  });

  it('stops at the start and end of the day', () => {
    const start = computeResize({
      ...base,
      entry: alone,
      entries,
      edge: 'start',
      requestedOffsetMins: -30,
    });
    const end = computeResize({
      ...base,
      entry: alone,
      entries,
      edge: 'end',
      requestedOffsetMins: 5000,
    });

    expect([start.startOffsetMins, start.atLimit]).toEqual([0, true]);
    expect([end.endOffsetMins, end.atLimit]).toEqual([1440, true]);
  });

  it('stops the end at "now"', () => {
    const result = computeResize({
      ...base,
      nowLimitMins: 400,
      entry: alone,
      entries,
      edge: 'end',
      requestedOffsetMins: 900,
    });

    expect([result.endOffsetMins, result.atLimit]).toEqual([400, true]);
  });

  it('does not report a limit when the request is exactly the limit', () => {
    const result = computeResize({
      ...base,
      entry: alone,
      entries,
      edge: 'end',
      requestedOffsetMins: 110,
    });

    expect(result.atLimit).toBe(false);
  });

  it('can be sent to its limit with an infinite request (Home / End)', () => {
    const toStart = computeResize({
      ...base,
      entry: alone,
      entries,
      edge: 'start',
      requestedOffsetMins: -Infinity,
    });
    const toEnd = computeResize({
      ...base,
      entry: alone,
      entries,
      edge: 'end',
      requestedOffsetMins: Infinity,
    });

    expect(toStart.startOffsetMins).toBe(0);
    expect(toEnd.endOffsetMins).toBe(1440);
  });
});

describe('computeResize - a neighbour that shares the edge', () => {
  // A 0-60, B 60-100 (the one resized), C 100-160, D 200-260
  const a = entry(1, 0, 60);
  const b = entry(2, 60, 100);
  const c = entry(3, 100, 160);
  const d = entry(4, 200, 260);
  const entries = [a, b, c, d];

  it('moves the facing boundary of the Entry after it, with the end edge', () => {
    const result = computeResize({
      ...base,
      entry: b,
      entries,
      edge: 'end',
      requestedOffsetMins: 120,
    });

    expect([result.startOffsetMins, result.endOffsetMins]).toEqual([60, 120]);
    expect(result.neighbours).toEqual([{ id: 3, startOffsetMins: 120, endOffsetMins: 160 }]);
  });

  it('lengthens it when the edge is moved away', () => {
    const result = computeResize({
      ...base,
      entry: b,
      entries,
      edge: 'end',
      requestedOffsetMins: 80,
    });

    expect(result.neighbours).toEqual([{ id: 3, startOffsetMins: 80, endOffsetMins: 160 }]);
  });

  it('moves the facing boundary of the Entry before it, with the start edge', () => {
    const result = computeResize({
      ...base,
      entry: b,
      entries,
      edge: 'start',
      requestedOffsetMins: 40,
    });

    expect([result.startOffsetMins, result.endOffsetMins]).toEqual([40, 100]);
    expect(result.neighbours).toEqual([{ id: 1, startOffsetMins: 0, endOffsetMins: 40 }]);
  });

  it('stops where the neighbour would be left with 10 minutes', () => {
    const end = computeResize({
      ...base,
      entry: b,
      entries,
      edge: 'end',
      requestedOffsetMins: 400,
    });
    const start = computeResize({
      ...base,
      entry: b,
      entries,
      edge: 'start',
      requestedOffsetMins: -400,
    });

    expect([end.endOffsetMins, end.atLimit]).toEqual([150, true]);
    expect(end.neighbours).toEqual([{ id: 3, startOffsetMins: 150, endOffsetMins: 160 }]);
    expect([start.startOffsetMins, start.atLimit]).toEqual([10, true]);
    expect(start.neighbours).toEqual([{ id: 1, startOffsetMins: 0, endOffsetMins: 10 }]);
  });

  it('never reaches the Entry beyond that neighbour', () => {
    const result = computeResize({
      ...base,
      entry: b,
      entries,
      edge: 'end',
      requestedOffsetMins: 1000,
    });

    expect(result.neighbours.map((n) => n.id)).toEqual([3]);
  });

  it('reports the neighbour at its original span when the edge has not moved', () => {
    const result = computeResize({
      ...base,
      entry: b,
      entries,
      edge: 'end',
      requestedOffsetMins: 100,
    });

    expect(result.neighbours).toEqual([{ id: 3, startOffsetMins: 100, endOffsetMins: 160 }]);
  });
});

describe('computeResize - a gap beside the edge', () => {
  const a = entry(1, 0, 30);
  const b = entry(2, 60, 100);
  const c = entry(3, 160, 200);
  const entries = [a, b, c];

  it('moves only the Entry, into the gap', () => {
    const result = computeResize({
      ...base,
      entry: b,
      entries,
      edge: 'end',
      requestedOffsetMins: 140,
    });

    expect([result.endOffsetMins, result.atLimit]).toEqual([140, false]);
    expect(result.neighbours).toEqual([]);
  });

  it('stops at the next Entry beyond the gap, which does not move', () => {
    const end = computeResize({
      ...base,
      entry: b,
      entries,
      edge: 'end',
      requestedOffsetMins: 500,
    });
    const start = computeResize({
      ...base,
      entry: b,
      entries,
      edge: 'start',
      requestedOffsetMins: -500,
    });

    expect([end.endOffsetMins, end.atLimit, end.neighbours]).toEqual([160, true, []]);
    expect([start.startOffsetMins, start.atLimit, start.neighbours]).toEqual([30, true, []]);
  });
});

describe('computeResize - multiple-choice Dimensions', () => {
  const a = entry(1, 0, 60);
  const b = entry(2, 60, 100);
  const entries = [a, b];

  it('ignores other Entries: they may overlap, and none is adjusted', () => {
    const end = computeResize({
      entry: a,
      entries,
      edge: 'end',
      requestedOffsetMins: 300,
      singleChoice: false,
      nowLimitMins: 1440,
    });

    expect([end.endOffsetMins, end.atLimit, end.neighbours]).toEqual([300, false, []]);
  });

  it('is still limited by the day, "now" and the minimum length', () => {
    const result = computeResize({
      entry: a,
      entries,
      edge: 'end',
      requestedOffsetMins: 900,
      singleChoice: false,
      nowLimitMins: 500,
    });

    expect([result.endOffsetMins, result.atLimit]).toEqual([500, true]);
  });
});
