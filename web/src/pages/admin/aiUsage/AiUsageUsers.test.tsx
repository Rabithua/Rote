import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SWRConfig } from 'swr';
import { get } from '@/utils/api';
import AiUsageUsers from './AiUsageUsers';
import type { AiUsageMetrics } from './types';

vi.mock('@/utils/api', () => ({ get: vi.fn() }));
const range = { startAt: '2026-09-09T00:00:00Z', endAt: '2026-10-09T00:00:00Z' };
const metrics = {
  totalTokens: '9007199254740993',
  promptTokens: '100',
  completionTokens: '20',
  calls: 2,
} as AiUsageMetrics;
const users = Array.from({ length: 23 }, (_, i) => ({
  id: String(i),
  username: `user-${i + 1}`,
  avatar: null,
  metrics,
}));
function mount() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, errorRetryCount: 0 }}>
      <AiUsageUsers range={range} />
    </SWRConfig>
  );
}
beforeEach(() => {
  vi.mocked(get).mockReset();
  vi.mocked(get).mockImplementation(async (url) => {
    const params = new URLSearchParams(String(url).split('?')[1]);
    const page = Number(params.get('page'));
    const limit = Number(params.get('limit'));
    return {
      data: {
        users: users.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total: 23, pages: 2 },
      },
    };
  });
});

it('exposes all users beyond the initial ranking and uses only the selected time range', async () => {
  mount();
  await screen.findByText('user-20');
  expect(screen.getByText('user-11')).toBeVisible();
  expect(screen.queryByText('user-21')).not.toBeInTheDocument();
  expect(screen.getAllByText('9,007,199,254,740,993')).toHaveLength(20);
  expect(screen.getByRole('button', { name: 'previous' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'next' }));
  await screen.findByText('user-23');
  expect(screen.queryByText('user-1')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'next' })).toBeDisabled();
  const query = new URLSearchParams(String(vi.mocked(get).mock.calls[1][0]).split('?')[1]);
  expect(Object.fromEntries(query)).toEqual({ ...range, type: 'all', page: '2', limit: '20' });
  fireEvent.click(screen.getByRole('button', { name: 'previous' }));
  await screen.findByText('user-1');
  expect(screen.getByRole('button', { name: 'previous' })).toBeDisabled();
});

it('shows an empty table without pagination when the range has no user usage', async () => {
  vi.mocked(get).mockResolvedValue({
    data: { users: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } },
  });
  mount();
  expect(await screen.findByText('empty')).toBeVisible();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('reports a failed user table request explicitly', async () => {
  vi.mocked(get).mockRejectedValue(new Error('failed'));
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('error');
});
