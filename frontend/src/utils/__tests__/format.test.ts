import { describe, expect, it } from 'vitest';
import { formatRecentTime } from '../format';

describe('formatRecentTime', () => {
  const now = new Date('2026-09-05T12:00:00.000Z').getTime();

  it('formats recent persisted timestamps without fake dates', () => {
    expect(formatRecentTime('2026-09-05T11:59:40.000Z', now)).toBe('刚刚');
    expect(formatRecentTime('2026-09-05T10:00:00.000Z', now)).toBe('2 小时前');
    expect(formatRecentTime('2026-09-04T12:00:00.000Z', now)).toBe('昨天');
  });

  it('uses a neutral fallback for missing timestamps', () => {
    expect(formatRecentTime(null, now)).toBe('最近');
    expect(formatRecentTime('not-a-date', now)).toBe('最近');
  });
});
