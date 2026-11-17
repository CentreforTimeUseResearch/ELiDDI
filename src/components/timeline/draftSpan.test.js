import { describe, it, expect } from 'vitest';
import { computeDraftResize, computeDraftMove } from './draftSpan';

const draft = { startOffsetMins: 100, endOffsetMins: 130 };
const base = { draft, entries: [], singleChoice: true, nowLimitMins: 1440 };
const entry = (startOffsetMins, endOffsetMins) => ({ id: 1, startOffsetMins, endOffsetMins });

describe('computeDraftResize', () => {
  it('moves only the asked edge', () => {
    expect(computeDraftResize({ ...base, edge: 'start', requestedOffsetMins: 60 })).toEqual({
      startOffsetMins: 60,
      endOffsetMins: 130,
      atLimit: false,
      neighbours: [],
    });
    expect(computeDraftResize({ ...base, edge: 'end', requestedOffsetMins: 200 })).toMatchObject({
      startOffsetMins: 100,
      endOffsetMins: 200,
    });
  });

  it('keeps at least 10 minutes', () => {
    expect(computeDraftResize({ ...base, edge: 'start', requestedOffsetMins: 500 })).toMatchObject({
      startOffsetMins: 120,
      atLimit: true,
    });
    expect(computeDraftResize({ ...base, edge: 'end', requestedOffsetMins: 0 })).toMatchObject({
      endOffsetMins: 110,
      atLimit: true,
    });
  });

  it('stops at a neighbour without trimming it (single-choice)', () => {
    const entries = [entry(40, 80), entry(160, 200)];
    expect(computeDraftResize({ ...base, entries, edge: 'start', requestedOffsetMins: 0 })).toEqual(
      {
        startOffsetMins: 80,
        endOffsetMins: 130,
        atLimit: true,
        neighbours: [],
      }
    );
    expect(computeDraftResize({ ...base, entries, edge: 'end', requestedOffsetMins: 400 })).toEqual(
      {
        startOffsetMins: 100,
        endOffsetMins: 160,
        atLimit: true,
        neighbours: [],
      }
    );
  });

  it('ignores neighbours on a multiple-choice Dimension', () => {
    const entries = [entry(40, 80), entry(160, 200)];
    const result = computeDraftResize({
      ...base,
      entries,
      singleChoice: false,
      edge: 'end',
      requestedOffsetMins: 400,
    });
    expect(result.endOffsetMins).toBe(400);
  });

  it('stops at the day edges and at "now"', () => {
    expect(computeDraftResize({ ...base, edge: 'start', requestedOffsetMins: -50 })).toMatchObject({
      startOffsetMins: 0,
    });
    expect(
      computeDraftResize({ ...base, nowLimitMins: 150, edge: 'end', requestedOffsetMins: 900 })
    ).toMatchObject({ endOffsetMins: 150, atLimit: true });
  });
});

describe('computeDraftMove', () => {
  it('keeps the length', () => {
    expect(computeDraftMove({ ...base, requestedStart: 300 })).toEqual({
      startOffsetMins: 300,
      endOffsetMins: 330,
      atLimit: false,
      neighbours: [],
    });
  });

  it('stops against neighbours, the day and "now"', () => {
    const entries = [entry(40, 80), entry(160, 200)];
    expect(computeDraftMove({ ...base, entries, requestedStart: 0 })).toMatchObject({
      startOffsetMins: 80,
      atLimit: true,
    });
    expect(computeDraftMove({ ...base, entries, requestedStart: 500 })).toMatchObject({
      startOffsetMins: 130,
      endOffsetMins: 160,
      atLimit: true,
    });
    expect(computeDraftMove({ ...base, requestedStart: 5000 })).toMatchObject({
      endOffsetMins: 1440,
    });
    expect(computeDraftMove({ ...base, nowLimitMins: 200, requestedStart: 900 })).toMatchObject({
      endOffsetMins: 200,
    });
  });
});
