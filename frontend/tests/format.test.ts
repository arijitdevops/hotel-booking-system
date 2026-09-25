import { describe, expect, it } from 'vitest';

import {
  addDaysIso,
  formatCurrency,
  formatDate,
  nightsBetween,
  pluralise,
  titleCase,
} from '../src/lib/format';

describe('format helpers', () => {
  it('formats euro amounts with two decimals', () => {
    expect(formatCurrency(1234.5)).toBe('€1,234.50');
  });

  it('formats ISO dates for display', () => {
    expect(formatDate('2026-05-01')).toBe('1 May 2026');
  });

  it('adds days across a month boundary', () => {
    expect(addDaysIso('2026-01-30', 3)).toBe('2026-02-02');
  });

  it('counts nights between two dates', () => {
    expect(nightsBetween('2026-03-10', '2026-03-13')).toBe(3);
    expect(nightsBetween('2026-03-10', '2026-03-10')).toBe(0);
  });

  it('pluralises and title-cases enum labels', () => {
    expect(pluralise(1, 'night')).toBe('1 night');
    expect(pluralise(2, 'night')).toBe('2 nights');
    expect(titleCase('CHECKED_IN')).toBe('Checked In');
  });
});
