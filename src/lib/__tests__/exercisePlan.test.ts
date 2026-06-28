import {
  formatSetGroups,
  getExerciseSetGroups,
  getFirstSetGroup,
  getTotalSets,
  normalizeSetGroups,
  sanitizeSetGroup,
} from '../exercisePlan';

describe('sanitizeSetGroup', () => {
  it('keeps valid positive integers untouched', () => {
    expect(sanitizeSetGroup({ reps: 10, sets: 3 })).toEqual({ reps: 10, sets: 3 });
  });

  it('truncates fractional values toward zero', () => {
    expect(sanitizeSetGroup({ reps: 8.9, sets: 3.2 })).toEqual({ reps: 8, sets: 3 });
  });

  it('clamps zero and negative values up to 1', () => {
    expect(sanitizeSetGroup({ reps: 0, sets: -4 })).toEqual({ reps: 1, sets: 1 });
  });
});

describe('normalizeSetGroups', () => {
  it('returns the default group when value is not an array', () => {
    expect(normalizeSetGroups(undefined)).toEqual([{ reps: 1, sets: 1 }]);
    expect(normalizeSetGroups(null)).toEqual([{ reps: 1, sets: 1 }]);
    expect(normalizeSetGroups('nope')).toEqual([{ reps: 1, sets: 1 }]);
  });

  it('uses the provided fallback (sanitized) when value is not an array', () => {
    expect(normalizeSetGroups(null, { reps: 12, sets: 4 })).toEqual([{ reps: 12, sets: 4 }]);
    expect(normalizeSetGroups(null, { reps: 0, sets: -1 })).toEqual([{ reps: 1, sets: 1 }]);
  });

  it('sanitizes every valid group in the array', () => {
    expect(
      normalizeSetGroups([
        { reps: 10, sets: 3 },
        { reps: 8.7, sets: 2.4 },
      ]),
    ).toEqual([
      { reps: 10, sets: 3 },
      { reps: 8, sets: 2 },
    ]);
  });

  it('drops invalid entries (non-objects, NaN, non-finite)', () => {
    expect(
      normalizeSetGroups([
        null,
        'x',
        { reps: 'abc', sets: 3 },
        { reps: Infinity, sets: 2 },
        { reps: 5, sets: 5 },
      ]),
    ).toEqual([{ reps: 5, sets: 5 }]);
  });

  it('falls back when the array has no valid groups', () => {
    expect(normalizeSetGroups([null, { reps: NaN, sets: NaN }], { reps: 9, sets: 9 })).toEqual([
      { reps: 9, sets: 9 },
    ]);
  });

  it('coerces numeric strings to numbers', () => {
    expect(normalizeSetGroups([{ reps: '10', sets: '3' }])).toEqual([{ reps: 10, sets: 3 }]);
  });
});

describe('getExerciseSetGroups', () => {
  it('prefers stored set_groups when present', () => {
    expect(
      getExerciseSetGroups({ reps: 5, sets: 5, set_groups: [{ reps: 12, sets: 4 }] }),
    ).toEqual([{ reps: 12, sets: 4 }]);
  });

  it('falls back to legacy reps/sets columns when set_groups is missing', () => {
    expect(
      getExerciseSetGroups({ reps: 12, sets: 4, set_groups: undefined as never }),
    ).toEqual([{ reps: 12, sets: 4 }]);
  });
});

describe('getFirstSetGroup', () => {
  it('returns the first group', () => {
    expect(
      getFirstSetGroup([
        { reps: 10, sets: 3 },
        { reps: 8, sets: 2 },
      ]),
    ).toEqual({ reps: 10, sets: 3 });
  });

  it('returns the default group for an empty array', () => {
    expect(getFirstSetGroup([])).toEqual({ reps: 1, sets: 1 });
  });
});

describe('getTotalSets', () => {
  it('sums sets across groups', () => {
    expect(
      getTotalSets([
        { reps: 10, sets: 3 },
        { reps: 8, sets: 2 },
        { reps: 6, sets: 1 },
      ]),
    ).toBe(6);
  });

  it('sanitizes before summing', () => {
    expect(getTotalSets([{ reps: 10, sets: 2.9 }, { reps: 8, sets: 0 }])).toBe(3);
  });

  it('returns 0 for an empty list', () => {
    expect(getTotalSets([])).toBe(0);
  });
});

describe('formatSetGroups', () => {
  it('pluralizes reps correctly', () => {
    expect(formatSetGroups([{ reps: 1, sets: 3 }])).toBe('1 rep x 3 series');
    expect(formatSetGroups([{ reps: 10, sets: 3 }])).toBe('10 reps x 3 series');
  });

  it('joins multiple groups with commas', () => {
    expect(
      formatSetGroups([
        { reps: 10, sets: 3 },
        { reps: 1, sets: 1 },
      ]),
    ).toBe('10 reps x 3 series, 1 rep x 1 series');
  });

  it('sanitizes values before formatting', () => {
    expect(formatSetGroups([{ reps: 8.9, sets: 0 }])).toBe('8 reps x 1 series');
  });
});
