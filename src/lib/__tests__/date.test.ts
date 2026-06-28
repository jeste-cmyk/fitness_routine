import { getLocalDateString, getTodayWeekday } from '../date';

describe('getLocalDateString', () => {
  it('formats a date as YYYY-MM-DD using local parts', () => {
    // Constructed with local components so the result is timezone-independent.
    expect(getLocalDateString(new Date(2026, 5, 28))).toBe('2026-06-28');
  });

  it('zero-pads single-digit months and days', () => {
    expect(getLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('defaults to the current date when no argument is given', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 9, 12, 0, 0));

    try {
      expect(getLocalDateString()).toBe('2026-03-09');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('getTodayWeekday', () => {
  it('returns the weekday index of the current date (0=Sun..6=Sat)', () => {
    jest.useFakeTimers();
    // 2026-06-28 is a Sunday.
    jest.setSystemTime(new Date(2026, 5, 28, 9, 0, 0));

    try {
      expect(getTodayWeekday()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns a Wednesday as 3', () => {
    jest.useFakeTimers();
    // 2026-07-01 is a Wednesday.
    jest.setSystemTime(new Date(2026, 6, 1, 9, 0, 0));

    try {
      expect(getTodayWeekday()).toBe(3);
    } finally {
      jest.useRealTimers();
    }
  });
});
