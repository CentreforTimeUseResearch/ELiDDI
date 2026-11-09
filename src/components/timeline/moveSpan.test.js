import { describe, it, expect } from 'vitest';
import { computeMove } from './moveSpan';

const entry = (id, startOffsetMins, endOffsetMins) => ({
  id,
  startOffsetMins,
  endOffsetMins,
  activity: `entry ${id}`,
});

const base = { singleChoice: true, nowLimitMins: 1440 };

// the span of the neighbour with this id in a result
const neighbour = (result, id) => result.neighbours.find((n) => n.id === id);

describe('computeMove - on its own', () => {
  const moving = entry(1, 100, 140); // 40 minutes
  const entries = [moving];

  it('moves the Entry, keeping its duration', () => {
    expect(computeMove({ ...base, entry: moving, entries, requestedStart: 200 })).toEqual({
      startOffsetMins: 200,
      endOffsetMins: 240,
      atLimit: false,
      neighbours: [],
    });
  });

  it('moves it earlier too', () => {
    const result = computeMove({ ...base, entry: moving, entries, requestedStart: 20 });

    expect([result.startOffsetMins, result.endOffsetMins]).toEqual([20, 60]);
  });

  it('stops at the start of the day', () => {
    const result = computeMove({ ...base, entry: moving, entries, requestedStart: -50 });

    expect([result.startOffsetMins, result.endOffsetMins]).toEqual([0, 40]);
    expect(result.atLimit).toBe(true);
  });

  it('stops where the end would pass the end of the day', () => {
    const result = computeMove({ ...base, entry: moving, entries, requestedStart: 1430 });

    expect([result.startOffsetMins, result.endOffsetMins]).toEqual([1400, 1440]);
    expect(result.atLimit).toBe(true);
  });

  it('stops where the end would pass "now"', () => {
    const result = computeMove({
      ...base,
      entry: moving,
      entries,
      requestedStart: 700,
      nowLimitMins: 650,
    });

    expect([result.startOffsetMins, result.endOffsetMins]).toEqual([610, 650]);
    expect(result.atLimit).toBe(true);
  });

  it('can always stay where it is, even if that is already past "now"', () => {
    const result = computeMove({
      ...base,
      entry: moving,
      entries,
      requestedStart: 100,
      nowLimitMins: 120,
    });

    expect([result.startOffsetMins, result.endOffsetMins]).toEqual([100, 140]);
  });
});

describe('computeMove - single-choice neighbours', () => {
  // before 0-60, moving 60-100, after 100-160, and a far one 200-260
  const before = entry(1, 0, 60);
  const moving = entry(2, 60, 100);
  const after = entry(3, 100, 160);
  const far = entry(4, 200, 260);
  const entries = [before, moving, after, far];

  it('trims the Entry ahead on its facing side when slid over it', () => {
    const result = computeMove({ ...base, entry: moving, entries, requestedStart: 90 });

    expect([result.startOffsetMins, result.endOffsetMins]).toEqual([90, 130]);
    expect(neighbour(result, 3)).toEqual({ id: 3, startOffsetMins: 130, endOffsetMins: 160 });
    expect(result.atLimit).toBe(false);
  });

  it('trims the Entry behind on its facing side when slid over it', () => {
    const result = computeMove({ ...base, entry: moving, entries, requestedStart: 30 });

    expect([result.startOffsetMins, result.endOffsetMins]).toEqual([30, 70]);
    expect(neighbour(result, 1)).toEqual({ id: 1, startOffsetMins: 0, endOffsetMins: 30 });
  });

  it('stops where the Entry ahead would be left with 10 minutes', () => {
    const result = computeMove({ ...base, entry: moving, entries, requestedStart: 200 });

    expect([result.startOffsetMins, result.endOffsetMins]).toEqual([110, 150]);
    expect(neighbour(result, 3)).toEqual({ id: 3, startOffsetMins: 150, endOffsetMins: 160 });
    expect(result.atLimit).toBe(true);
  });

  it('stops where the Entry behind would be left with 10 minutes', () => {
    const result = computeMove({ ...base, entry: moving, entries, requestedStart: -100 });

    expect([result.startOffsetMins, result.endOffsetMins]).toEqual([10, 50]);
    expect(neighbour(result, 1)).toEqual({ id: 1, startOffsetMins: 0, endOffsetMins: 10 });
    expect(result.atLimit).toBe(true);
  });

  it('never reaches the Entry beyond the one ahead: swapping is not possible', () => {
    const result = computeMove({ ...base, entry: moving, entries, requestedStart: 1000 });

    expect(result.endOffsetMins).toBeLessThanOrEqual(150);
    expect(neighbour(result, 4)).toBeUndefined();
  });

  it('reports the neighbours at their original spans when the move has not reached them', () => {
    const result = computeMove({ ...base, entry: moving, entries, requestedStart: 60 });

    expect(neighbour(result, 1)).toEqual({ id: 1, startOffsetMins: 0, endOffsetMins: 60 });
    expect(neighbour(result, 3)).toEqual({ id: 3, startOffsetMins: 100, endOffsetMins: 160 });
  });

  it('does not extend a neighbour into the space it leaves behind', () => {
    const result = computeMove({ ...base, entry: moving, entries, requestedStart: 70 });

    expect(neighbour(result, 1)).toEqual({ id: 1, startOffsetMins: 0, endOffsetMins: 60 });
  });

  it('moves freely across a gap, and is stopped by the Entry on the far side of it', () => {
    const lonely = entry(5, 60, 80);
    const wall = entry(6, 200, 230);
    const open = computeMove({
      ...base,
      entry: lonely,
      entries: [lonely, wall],
      requestedStart: 150,
    });
    const blocked = computeMove({
      ...base,
      entry: lonely,
      entries: [lonely, wall],
      requestedStart: 400,
    });

    expect([open.startOffsetMins, open.endOffsetMins]).toEqual([150, 170]);
    expect(neighbour(open, 6)).toEqual({ id: 6, startOffsetMins: 200, endOffsetMins: 230 });
    expect([blocked.startOffsetMins, blocked.endOffsetMins]).toEqual([200, 220]);
    expect(neighbour(blocked, 6)).toEqual({ id: 6, startOffsetMins: 220, endOffsetMins: 230 });
  });

  it('is limited by "now" as well as by neighbours', () => {
    const result = computeMove({
      ...base,
      entry: moving,
      entries,
      requestedStart: 90,
      nowLimitMins: 120,
    });

    expect([result.startOffsetMins, result.endOffsetMins]).toEqual([80, 120]);
    expect(result.atLimit).toBe(true);
  });
});

describe('computeMove - multiple-choice Dimensions', () => {
  const a = entry(1, 0, 60);
  const b = entry(2, 100, 140);
  const entries = [a, b];

  it('moves over other Entries without touching them', () => {
    const result = computeMove({
      entry: a,
      entries,
      requestedStart: 90,
      singleChoice: false,
      nowLimitMins: 1440,
    });

    expect([result.startOffsetMins, result.endOffsetMins]).toEqual([90, 150]);
    expect(result.neighbours).toEqual([]);
    expect(result.atLimit).toBe(false);
  });

  it('is still limited by the day and "now"', () => {
    const result = computeMove({
      entry: a,
      entries,
      requestedStart: 300,
      singleChoice: false,
      nowLimitMins: 200,
    });

    expect([result.startOffsetMins, result.endOffsetMins]).toEqual([140, 200]);
    expect(result.atLimit).toBe(true);
  });
});
