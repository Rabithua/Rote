import { describe, expect, it } from 'vitest';
import { aiUsageRange } from './range';
import { buildDailyTokenTrend } from './trendData';
import type { AiUsageMetrics } from './types';

const metrics: AiUsageMetrics = {
  totalTokens: '120',
  promptTokens: '100',
  completionTokens: '20',
  calls: 1,
  reportedCalls: 1,
  unknownCalls: 0,
  legacyRecords: 0,
  failedCalls: 0,
  cancelledCalls: 0,
  cacheHitTokens: null,
  cacheMissTokens: null,
  reasoningTokens: null,
  cacheHitReportedCalls: 0,
  cacheMissReportedCalls: 0,
  reasoningReportedCalls: 0,
};
const range = {
  startAt: '2026-09-30T16:00:00Z',
  endAt: '2026-10-03T16:00:00Z',
  timeZone: 'Asia/Shanghai',
};

describe('daily AI token trend', () => {
  it('fills empty Shanghai days with zero and excludes the ending midnight', () => {
    const points = buildDailyTokenTrend([{ date: '2026-10-02', metrics }], range);
    expect(points.map((point) => point.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(points.map((point) => point.totalTokens)).toEqual([0, 120, 0]);
    expect(points[1].metrics).toBe(metrics);
    expect(points[0].metrics).toBeUndefined();
  });

  it.each([
    ['7d', 8],
    ['30d', 31],
  ] as const)('retains partial first and last days in a rolling %s window', (period, count) => {
    const window = aiUsageRange(period, new Date('2026-10-09T04:00:00Z'));
    const points = buildDailyTokenTrend([], { ...window, timeZone: 'Asia/Shanghai' });
    expect(points).toHaveLength(count);
    expect(points.at(-1)?.date).toBe('2026-10-09');
  });

  it('keeps a single-day range and returns no points for a zero-duration range', () => {
    const singleDay = { ...range, endAt: '2026-10-01T04:00:00Z' };
    expect(buildDailyTokenTrend([], singleDay).map((point) => point.date)).toEqual(['2026-10-01']);
    expect(buildDailyTokenTrend([], { ...range, endAt: range.startAt })).toEqual([]);
  });

  it('leaves gaps for unreported usage without erasing any reported partial values', () => {
    const unknown = {
      ...metrics,
      totalTokens: null,
      promptTokens: '9',
      completionTokens: null,
      reportedCalls: 0,
      unknownCalls: 1,
    };
    const points = buildDailyTokenTrend([{ date: '2026-10-02', metrics: unknown }], range);
    expect(points[1]).toMatchObject({
      totalTokens: null,
      promptTokens: 9,
      completionTokens: null,
      metrics: { unknownCalls: 1 },
    });
  });

  it('distinguishes omitted components from an explicitly reported zero', () => {
    const totalOnly = { ...metrics, promptTokens: null, completionTokens: null };
    const promptZero = {
      ...metrics,
      totalTokens: null,
      promptTokens: '0',
      completionTokens: null,
      reportedCalls: 0,
      unknownCalls: 1,
    };
    const points = buildDailyTokenTrend(
      [
        { date: '2026-10-01', metrics: totalOnly },
        { date: '2026-10-02', metrics: promptZero },
      ],
      range
    );
    expect(points[0]).toMatchObject({
      totalTokens: 120,
      promptTokens: null,
      completionTokens: null,
    });
    expect(points[1]).toMatchObject({ totalTokens: null, promptTokens: 0, completionTokens: null });
    expect(points[2]).toMatchObject({ totalTokens: 0, promptTokens: 0, completionTokens: 0 });
  });

  it('preserves exact strings for tooltips while treating reported zero and legacy usage as known', () => {
    const exact = { ...metrics, totalTokens: '9007199254740993' };
    const points = buildDailyTokenTrend([{ date: '2026-10-02', metrics: exact }], range);
    expect(points[1].metrics?.totalTokens).toBe('9007199254740993');
    const zero = { ...metrics, totalTokens: '0', promptTokens: '0', completionTokens: '0' };
    const legacy = { ...zero, calls: 0, reportedCalls: 0, legacyRecords: 1 };
    expect(
      buildDailyTokenTrend([{ date: '2026-10-02', metrics: zero }], range)[1].totalTokens
    ).toBe(0);
    expect(
      buildDailyTokenTrend([{ date: '2026-10-02', metrics: legacy }], range)[1].totalTokens
    ).toBe(0);
  });
});
