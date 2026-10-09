import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SWRConfig } from 'swr';
import { createInstance } from 'i18next';
import { get } from '@/utils/api';
import AiUsagePanel from './AiUsagePanel';
import { aiUsageRange, formatTokenCount } from './range';
import type { AiUsageMetrics, AiUsageStatistics } from './types';
import en from '@/locales/en.json';
import zh from '@/locales/zh.json';
import ja from '@/locales/ja.json';

vi.mock('@/utils/api', () => ({ get: vi.fn() }));
const metrics: AiUsageMetrics = {
  totalTokens: '120',
  promptTokens: '100',
  completionTokens: '20',
  calls: 2,
  reportedCalls: 1,
  unknownCalls: 1,
  legacyRecords: 1,
  failedCalls: 0,
  cancelledCalls: 0,
  cacheHitTokens: null,
  cacheMissTokens: null,
  reasoningTokens: null,
  cacheHitReportedCalls: 0,
  cacheMissReportedCalls: 0,
  reasoningReportedCalls: 0,
};
const fixture: AiUsageStatistics = {
  range: {
    startAt: '2026-09-09T00:00:00Z',
    endAt: '2026-10-09T00:00:00Z',
    timeZone: 'Asia/Shanghai',
  },
  summary: metrics,
  system: { ...metrics, totalTokens: '0', calls: 0, unknownCalls: 0 },
  unattributed: { ...metrics, totalTokens: '0', calls: 0, unknownCalls: 0 },
  models: [{ providerId: null, model: 'deepseek-flash', type: 'chat', metrics }],
  topUsers: [{ id: 'user', username: 'test-user', avatar: null, metrics }],
  availableModels: ['deepseek-flash', 'embedding-test'],
};
function mount() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, errorRetryCount: 0 }}>
      <AiUsagePanel />
    </SWRConfig>
  );
}
const summaryCalls = () =>
  vi.mocked(get).mock.calls.filter(([url]) => String(url).startsWith('/admin/stats/ai-usage?'));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T00:00:00Z'));
  vi.mocked(get).mockReset();
  vi.mocked(get).mockImplementation(async (url) => ({
    data: String(url).includes('/ai-usage/users?')
      ? { users: fixture.topUsers, pagination: { page: 1, limit: 20, total: 1, pages: 1 } }
      : fixture,
  }));
});
afterEach(() => vi.useRealTimers());

describe('AI usage dashboard', () => {
  it('fetches all usage for the selected period and refreshes the same window', async () => {
    mount();
    await screen.findByText('test-user');
    const first = new URLSearchParams(String(vi.mocked(get).mock.calls[0][0]).split('?')[1]);
    expect(first.get('type')).toBe('all');
    expect(
      new Date(first.get('endAt')!).getTime() - new Date(first.get('startAt')!).getTime()
    ).toBe(30 * 86400_000);
    expect(first.has('model')).toBe(false);
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'period' }), { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('option', { name: '7d' }));
    await waitFor(() => expect(summaryCalls()).toHaveLength(2));
    const second = new URLSearchParams(String(summaryCalls()[1][0]).split('?')[1]);
    expect(second.get('type')).toBe('all');
    expect(
      new Date(second.get('endAt')!).getTime() - new Date(second.get('startAt')!).getTime()
    ).toBe(7 * 86400_000);
    expect(second.get('endAt')).toBe(first.get('endAt'));
    await screen.findByText('test-user');
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'period' }), { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('option', { name: 'month' }));
    await waitFor(() => expect(summaryCalls()).toHaveLength(3));
    const month = new URLSearchParams(String(summaryCalls()[2][0]).split('?')[1]);
    expect(month.get('startAt')).toBe('2026-09-30T16:00:00.000Z');
    await screen.findByText('test-user');
    vi.setSystemTime(new Date('2026-10-09T00:01:00Z'));
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
    await waitFor(() => expect(summaryCalls()).toHaveLength(4));
    const last = new URLSearchParams(String(summaryCalls()[3][0]).split('?')[1]);
    expect(last.get('startAt')).toBe(month.get('startAt'));
    expect(last.get('endAt')).toBe('2026-10-09T00:01:00.000Z');
    await screen.findByText('test-user');
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
    await waitFor(() => expect(summaryCalls()).toHaveLength(5));
    expect(summaryCalls()[4][0]).toBe(summaryCalls()[3][0]);
    await waitFor(() =>
      expect(
        vi.mocked(get).mock.calls.filter(([url]) => String(url).includes('/ai-usage/users?'))
      ).toHaveLength(5)
    );
  });
  it('shows common metrics and model usage while keeping diagnostics expandable', async () => {
    mount();
    await screen.findByText('test-user');
    expect(screen.getByText('totalUsage')).toBeVisible();
    screen.getAllByText('promptTokens').forEach((element) => expect(element).toBeVisible());
    screen.getAllByText('completionTokens').forEach((element) => expect(element).toBeVisible());
    screen.getAllByText('calls').forEach((element) => expect(element).toBeVisible());
    screen.getAllByText('usage').forEach((element) => expect(element).toBeVisible());
    expect(screen.getByText('modelUsage')).toBeVisible();
    expect(screen.getAllByText('deepseek-flash')[0]).toBeVisible();
    const notes = screen.getByRole('button', { name: 'statisticsNotes' });
    expect(notes).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('system')).not.toBeVisible();
    expect(screen.getByText('coverage')).not.toBeVisible();
    fireEvent.click(notes);
    expect(notes).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText(/unknown/).length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('legacyProvider')).toBeVisible();
    expect(screen.getByText('legacyCount')).toBeVisible();
    expect(screen.getByText('system')).toBeVisible();
    expect(screen.getByText('unattributed')).toBeVisible();
    expect(screen.getByText('detailNote')).toBeVisible();
    expect(get).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText('statisticsNotes'));
    expect(screen.getByText('system')).not.toBeVisible();
  });
  it('shows load failures explicitly', async () => {
    vi.mocked(get).mockRejectedValue(new Error('failed'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('error');
  });
});

it('resolves Shanghai month boundaries even when UTC is still in the prior month', () => {
  expect(aiUsageRange('month', new Date('2026-09-30T16:00:00Z'))).toEqual({
    startAt: '2026-09-30T16:00:00.000Z',
    endAt: '2026-09-30T16:00:00.000Z',
  });
  expect(aiUsageRange('month', new Date('2026-10-31T16:01:00Z')).startAt).toBe(
    '2026-10-31T16:00:00.000Z'
  );
});
it('formats large integer totals without precision loss and preserves unknown values', () => {
  expect(formatTokenCount('9007199254740993')?.replace(/\D/g, '')).toBe('9007199254740993');
  expect(formatTokenCount(null)).toBeNull();
  expect(formatTokenCount('0')).toBe('0');
});
it('provides the same complete locale contract in Chinese, English, and Japanese', () => {
  const keys = Object.keys(en.pages.admin.dashboard.aiUsage).sort();
  expect(Object.keys(zh.pages.admin.dashboard.aiUsage).sort()).toEqual(keys);
  expect(Object.keys(ja.pages.admin.dashboard.aiUsage).sort()).toEqual(keys);
});

it.each([
  ['en', en],
  ['zh', zh],
  ['ja', ja],
])('preserves the percent unit of memory vector progress in %s', async (language, translations) => {
  const i18n = createInstance();
  await i18n.init({ lng: language, resources: { [language]: { translation: translations } } });
  for (const percent of [0, 75, 100]) {
    expect(i18n.t('pages.aiMemory.memoryStats.vectorProgressValue', { percent })).toBe(
      `${percent}%`
    );
  }
});
