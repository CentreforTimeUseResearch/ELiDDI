import { describe, it, expect } from 'vitest';
import { searchActivities, hasKnownActivity } from './activitySearch';

const content = [
  {
    name: 'Sleep and personal care',
    activities: [{ name: 'Sleep' }, { name: 'Wash and dress' }],
  },
  {
    name: 'Work',
    activities: [{ name: 'Paid work' }, { label: 'Study', name: 'study' }],
  },
];

describe('searchActivities', () => {
  it('filters each category down to activities matching the search string (case-insensitive)', () => {
    const results = searchActivities(content, 'sleep');
    expect(results).toEqual([
      { name: 'Sleep and personal care', activities: [{ name: 'Sleep' }] },
      { name: 'Work', activities: [] },
    ]);
  });

  // regression coverage (#146): search matched the raw name while the
  // picker shows - and hasKnownActivity compares - the label, so typing the
  // text a coded activity displays filtered that activity out
  it('matches a coded activity by the label it displays, like hasKnownActivity', () => {
    const coded = [
      { name: 'Personal', activities: [{ code: 110, name: 'Sleep (main)', label: 'Sleeping' }] },
    ];

    expect(searchActivities(coded, 'sleeping')[0].activities).toHaveLength(1);
    expect(hasKnownActivity(coded, 'sleeping')).toBe(true);
  });

  it('keeps every activity when the search string is empty', () => {
    const results = searchActivities(content, '');
    expect(results[0].activities).toHaveLength(2);
    expect(results[1].activities).toHaveLength(2);
  });
});

describe('hasKnownActivity', () => {
  it('matches an activity by its display name, falling back from label to name', () => {
    expect(hasKnownActivity(content, 'sleep')).toBe(true);
    expect(hasKnownActivity(content, 'Study')).toBe(true); // matches via label, not the raw name
  });

  it('returns false when no activity exactly matches the search string', () => {
    expect(hasKnownActivity(content, 'gardening')).toBe(false);
  });
});
