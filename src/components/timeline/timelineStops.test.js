import { describe, it, expect } from 'vitest';
import {
  buildStops,
  stopKey,
  stopContaining,
  neighbourStop,
  hourStop,
  firstStop,
  lastStop,
} from './timelineStops';

const entry = (id, startOffsetMins, endOffsetMins) => ({ id, startOffsetMins, endOffsetMins });

const slot = (startOffsetMins) => ({
  type: 'slot',
  startOffsetMins,
  endOffsetMins: startOffsetMins + 10,
});

describe('buildStops', () => {
  it('is 144 ten-minute slots for an empty day', () => {
    const stops = buildStops([]);

    expect(stops).toHaveLength(144);
    expect(stops[0]).toEqual(slot(0));
    expect(stops[143]).toEqual(slot(1430));
    expect(stops.every((stop) => stop.type === 'slot')).toBe(true);
  });

  it('replaces the slots an Entry covers with the Entry itself, in time order', () => {
    const stops = buildStops([entry(7, 30, 60)]);

    expect(stops.slice(0, 5).map(stopKey)).toEqual([
      'slot:0',
      'slot:10',
      'slot:20',
      'entry:7',
      'slot:60',
    ]);
    expect(stops).toHaveLength(144 - 3 + 1);
    expect(stops[3]).toEqual({ type: 'entry', id: 7, startOffsetMins: 30, endOffsetMins: 60 });
  });

  it('puts Entries in order whatever order they are given in', () => {
    const stops = buildStops([entry(2, 100, 120), entry(1, 0, 20)]);

    expect(stops[0]).toMatchObject({ type: 'entry', id: 1 });
    expect(stops.filter((stop) => stop.type === 'entry').map((stop) => stop.id)).toEqual([1, 2]);
  });

  it('has no slot between Entries that touch', () => {
    const stops = buildStops([entry(1, 0, 30), entry(2, 30, 60)]);

    expect(stops.slice(0, 3).map(stopKey)).toEqual(['entry:1', 'entry:2', 'slot:60']);
  });

  it('keeps overlapping Entries (multiple-choice) as separate stops, in start order', () => {
    const stops = buildStops([entry(1, 0, 60), entry(2, 30, 90)]);

    expect(stops.slice(0, 3).map(stopKey)).toEqual(['entry:1', 'entry:2', 'slot:90']);
  });

  it('counts a slot an Entry only partly covers as covered', () => {
    const stops = buildStops([entry(1, 5, 25)]);

    expect(stops.slice(0, 2).map(stopKey)).toEqual(['entry:1', 'slot:30']);
  });
});

describe('stopContaining', () => {
  const stops = buildStops([entry(1, 30, 90), entry(2, 100, 110)]);

  it('finds the slot a time is in', () => {
    expect(stopContaining(stops, 5)).toEqual(slot(0));
    expect(stopContaining(stops, 20)).toEqual(slot(20));
  });

  it('finds the Entry a time is in, from its first minute to its last', () => {
    expect(stopContaining(stops, 30)).toMatchObject({ type: 'entry', id: 1 });
    expect(stopContaining(stops, 89)).toMatchObject({ type: 'entry', id: 1 });
    expect(stopContaining(stops, 90)).toEqual(slot(90));
  });

  it('clamps a time outside the day to the first or last stop', () => {
    expect(stopContaining(stops, -50)).toEqual(slot(0));
    expect(stopContaining(stops, 5000)).toEqual(slot(1430));
  });
});

describe('neighbourStop', () => {
  const stops = buildStops([entry(1, 20, 60)]);

  it('moves to the next and previous stop', () => {
    expect(neighbourStop(stops, slot(0), 1)).toEqual(slot(10));
    expect(neighbourStop(stops, slot(10), 1)).toMatchObject({ type: 'entry', id: 1 });
    expect(neighbourStop(stops, stops[2], 1)).toEqual(slot(60));
    expect(neighbourStop(stops, slot(60), -1)).toMatchObject({ type: 'entry', id: 1 });
  });

  it('stays at either end of the day', () => {
    expect(neighbourStop(stops, slot(0), -1)).toEqual(slot(0));
    expect(neighbourStop(stops, slot(1430), 1)).toEqual(slot(1430));
  });

  it('finds its place by time when the current stop no longer exists', () => {
    // the slot at 30 is now covered by Entry 1
    expect(neighbourStop(stops, slot(30), 1)).toEqual(slot(60));
  });
});

describe('hourStop', () => {
  const stops = buildStops([entry(1, 100, 300)]); // a long Entry

  it('goes an hour on, to whatever is there', () => {
    expect(hourStop(stops, slot(0), 1)).toEqual(slot(60));
    expect(hourStop(stops, slot(120 + 400), -1)).toMatchObject({ type: 'slot' });
  });

  it('lands on an Entry the target time falls in', () => {
    expect(hourStop(stops, slot(60), 1)).toMatchObject({ type: 'entry', id: 1 }); // 120 is inside
  });

  it('steps past the current Entry rather than staying on it', () => {
    const entryStop = stops.find((stop) => stop.type === 'entry');

    expect(hourStop(stops, entryStop, 1)).toEqual(slot(300)); // 160 is still inside it
    expect(hourStop(stops, entryStop, -1)).toEqual(slot(40)); // an hour before its start
  });

  it('stops at the start and end of the day', () => {
    expect(hourStop(stops, slot(20), -1)).toEqual(slot(0));
    expect(hourStop(stops, slot(1400), 1)).toEqual(slot(1430));
  });
});

describe('firstStop and lastStop', () => {
  it('are the start and end of the day', () => {
    const stops = buildStops([entry(1, 0, 30), entry(2, 1400, 1440)]);

    expect(firstStop(stops)).toMatchObject({ type: 'entry', id: 1 });
    expect(lastStop(stops)).toMatchObject({ type: 'entry', id: 2 });
  });
});
