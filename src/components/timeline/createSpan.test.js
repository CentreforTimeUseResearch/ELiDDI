import { describe, it, expect } from 'vitest';
import { clampCreateSpan, DEFAULT_NEW_ENTRY_MINS } from './createSpan';

const entry = (startOffsetMins, endOffsetMins, id = startOffsetMins) => ({
  id,
  startOffsetMins,
  endOffsetMins,
});

const base = { entries: [], singleChoice: true, nowLimitMins: 1440 };

describe('clampCreateSpan - plain click', () => {
  it('makes a 30-minute block from the clicked slot', () => {
    expect(clampCreateSpan({ ...base, anchorMins: 60 })).toEqual({
      startOffsetMins: 60,
      endOffsetMins: 60 + DEFAULT_NEW_ENTRY_MINS,
      atLimit: false,
    });
    expect(DEFAULT_NEW_ENTRY_MINS).toBe(30);
  });

  it('is shortened to the free space before the next Entry', () => {
    const span = clampCreateSpan({ ...base, anchorMins: 60, entries: [entry(80, 120)] });

    expect(span).toEqual({ startOffsetMins: 60, endOffsetMins: 80, atLimit: true });
  });

  it('is shortened to the end of the day', () => {
    const span = clampCreateSpan({ ...base, anchorMins: 1430 });

    expect(span).toEqual({ startOffsetMins: 1430, endOffsetMins: 1440, atLimit: true });
  });

  it('is shortened to "now" on the current day', () => {
    const span = clampCreateSpan({ ...base, anchorMins: 600, nowLimitMins: 620 });

    expect(span).toEqual({ startOffsetMins: 600, endOffsetMins: 620, atLimit: true });
  });

  it('is one slot when exactly one slot is free', () => {
    const span = clampCreateSpan({ ...base, anchorMins: 60, entries: [entry(70, 100)] });

    expect(span).toEqual({ startOffsetMins: 60, endOffsetMins: 70, atLimit: true });
  });

  it('makes nothing when the clicked slot is already covered (single-choice)', () => {
    expect(clampCreateSpan({ ...base, anchorMins: 70, entries: [entry(60, 100)] })).toBeNull();
  });

  it('makes nothing when the clicked slot is at or after "now"', () => {
    expect(clampCreateSpan({ ...base, anchorMins: 620, nowLimitMins: 620 })).toBeNull();
    expect(clampCreateSpan({ ...base, anchorMins: 700, nowLimitMins: 620 })).toBeNull();
  });
});

describe('clampCreateSpan - drag', () => {
  it('spans from the anchor slot to the current slot, inclusive, dragging forwards', () => {
    const span = clampCreateSpan({ ...base, anchorMins: 60, currentMins: 90 });

    expect(span).toEqual({ startOffsetMins: 60, endOffsetMins: 100, atLimit: false });
  });

  it('spans from the current slot to the anchor slot, inclusive, dragging backwards', () => {
    const span = clampCreateSpan({ ...base, anchorMins: 90, currentMins: 60 });

    expect(span).toEqual({ startOffsetMins: 60, endOffsetMins: 100, atLimit: false });
  });

  it('is one slot when the pointer is back on the anchor slot', () => {
    const span = clampCreateSpan({ ...base, anchorMins: 60, currentMins: 60 });

    expect(span).toEqual({ startOffsetMins: 60, endOffsetMins: 70, atLimit: false });
  });

  it('stops at the next Entry when dragging forwards past it', () => {
    const span = clampCreateSpan({
      ...base,
      anchorMins: 60,
      currentMins: 200,
      entries: [entry(100, 140)],
    });

    expect(span).toEqual({ startOffsetMins: 60, endOffsetMins: 100, atLimit: true });
  });

  it('stops at the previous Entry when dragging backwards past it', () => {
    const span = clampCreateSpan({
      ...base,
      anchorMins: 200,
      currentMins: 20,
      entries: [entry(100, 140)],
    });

    expect(span).toEqual({ startOffsetMins: 140, endOffsetMins: 210, atLimit: true });
  });

  it('stops at the day edges', () => {
    expect(clampCreateSpan({ ...base, anchorMins: 20, currentMins: -50 })).toEqual({
      startOffsetMins: 0,
      endOffsetMins: 30,
      atLimit: true,
    });
    expect(clampCreateSpan({ ...base, anchorMins: 1400, currentMins: 5000 })).toEqual({
      startOffsetMins: 1400,
      endOffsetMins: 1440,
      atLimit: true,
    });
  });

  it('stops at "now" on the current day', () => {
    const span = clampCreateSpan({ ...base, anchorMins: 600, currentMins: 700, nowLimitMins: 640 });

    expect(span).toEqual({ startOffsetMins: 600, endOffsetMins: 640, atLimit: true });
  });

  it('does not report a limit when the drag exactly reaches one', () => {
    const span = clampCreateSpan({
      ...base,
      anchorMins: 60,
      currentMins: 90,
      entries: [entry(100, 140)],
    });

    expect(span).toEqual({ startOffsetMins: 60, endOffsetMins: 100, atLimit: false });
  });

  it('makes nothing when the anchor slot is covered', () => {
    expect(
      clampCreateSpan({ ...base, anchorMins: 110, currentMins: 150, entries: [entry(100, 140)] })
    ).toBeNull();
  });
});

describe('clampCreateSpan - multiple-choice Dimensions', () => {
  const multi = { ...base, singleChoice: false };

  it('ignores neighbouring Entries, so blocks may overlap them', () => {
    const entries = [entry(60, 120)];

    expect(clampCreateSpan({ ...multi, entries, anchorMins: 70 })).toEqual({
      startOffsetMins: 70,
      endOffsetMins: 100,
      atLimit: false,
    });
    expect(clampCreateSpan({ ...multi, entries, anchorMins: 70, currentMins: 200 })).toEqual({
      startOffsetMins: 70,
      endOffsetMins: 210,
      atLimit: false,
    });
  });

  it('is still limited by the day edges and "now"', () => {
    expect(clampCreateSpan({ ...multi, anchorMins: 1430 })).toEqual({
      startOffsetMins: 1430,
      endOffsetMins: 1440,
      atLimit: true,
    });
    expect(clampCreateSpan({ ...multi, anchorMins: 600, nowLimitMins: 620 })).toEqual({
      startOffsetMins: 600,
      endOffsetMins: 620,
      atLimit: true,
    });
  });
});
