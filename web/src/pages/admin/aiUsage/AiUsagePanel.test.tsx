import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SWRConfig } from 'swr';
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
beforeEach(() => {
  vi.mocked(get).mockReset();
  vi.mocked(get).mockResolvedValue({ data: fixture });
});

describe('AI usage dashboard', () => {
  it('sends explicit identical range boundaries while type/model filters change', async () => {
    mount();
    await screen.findByText('test-user');
    const first = new URLSearchParams(String(vi.mocked(get).mock.calls[0][0]).split('?')[1]);
    expect(first.get('type')).toBe('all');
    expect(
      new Date(first.get('endAt')!).getTime() - new Date(first.get('startAt')!).getTime()
    ).toBe(30 * 86400_000);
    fireEvent.change(screen.getByLabelText('type'), { target: { value: 'embedding' } });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    const second = new URLSearchParams(String(vi.mocked(get).mock.calls[1][0]).split('?')[1]);
    expect(second.get('type')).toBe('embedding');
    expect(second.get('startAt')).toBe(first.get('startAt'));
    expect(second.get('endAt')).toBe(first.get('endAt'));
    await screen.findByText('test-user');
    fireEvent.change(screen.getByLabelText('model'), { target: { value: 'embedding-test' } });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(3));
    expect(String(vi.mocked(get).mock.calls[2][0])).toContain('model=embedding-test');
    fireEvent.change(screen.getByLabelText('period'), { target: { value: '7d' } });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(4));
    const last = new URLSearchParams(String(vi.mocked(get).mock.calls[3][0]).split('?')[1]);
    expect(new Date(last.get('endAt')!).getTime() - new Date(last.get('startAt')!).getTime()).toBe(
      7 * 86400_000
    );
  });
  it('keeps missing details unknown and distinguishes legacy records and system groups', async () => {
    mount();
    await screen.findByText('test-user');
    expect(screen.getAllByText(/unknown/).length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('legacyProvider')).toBeVisible();
    expect(screen.getByText('legacyCount')).toBeVisible();
    expect(screen.getByText('system')).toBeVisible();
    expect(screen.getByText('unattributed')).toBeVisible();
    expect(screen.getByText('detailNote')).toBeVisible();
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
