import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthState } from '@/state/profile';
import { get } from '@/utils/api';
import DashboardTab from '../components/DashboardTab';
import type { DashboardStats } from '../types';
import AiUsagePage from './AiUsagePage';
import type { AiUsageMetrics, AiUsageStatistics } from './types';

vi.mock('@/utils/api', () => ({ get: vi.fn() }));
vi.mock('@/state/profile', () => ({ useAuthState: vi.fn() }));
vi.mock('@/layout/dashboard', () => ({ tabsData: [] }));
vi.mock('@/layout/ContainerWithSideBar', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const dashboard: DashboardStats = {
  globalStats: {
    users: 1,
    rotes: 0,
    articles: 0,
    attachments: 0,
    embeddingJobs: { pending: 0, running: 0, succeeded: 0, failed: 0 },
  },
  topUsersByNotes: [],
  topUsersByApi: [],
  topUsersByStorage: [],
  topUsersByTokenUsage: [
    {
      id: 'user',
      username: 'test-user',
      email: 'test@example.com',
      nickname: null,
      avatar: null,
      tokenUsage: '9007199254740993',
    },
  ],
};
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
const usage: AiUsageStatistics = {
  range: {
    startAt: '2026-09-09T00:00:00Z',
    endAt: '2026-10-09T00:00:00Z',
    timeZone: 'Asia/Shanghai',
  },
  summary: metrics,
  system: metrics,
  unattributed: metrics,
  models: [],
  topUsers: [],
  availableModels: [],
};

function mount(path = '/admin') {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, errorRetryCount: 0 }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin" element={<DashboardTab />} />
          <Route path="/admin/ai-usage" element={<AiUsagePage />} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>
  );
}

beforeEach(() => {
  vi.mocked(get).mockReset();
  vi.mocked(get).mockImplementation(async (url) => ({
    data:
      url === '/admin/stats/dashboard'
        ? dashboard
        : String(url).includes('/ai-usage/users?')
          ? { users: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } }
          : usage,
  }));
  vi.mocked(useAuthState).mockReturnValue({
    authReady: true,
    profile: { role: 'admin' },
  } as ReturnType<typeof useAuthState>);
});

describe('AI usage navigation', () => {
  it('loads only the compact ranking until clicked, then returns to the dashboard', async () => {
    mount();
    const link = await screen.findByRole('link', { name: 'aiUsage.viewDetails' });
    expect(within(link).getByText('test-user')).toBeVisible();
    expect(within(link).getByText('9,007,199,254,740,993')).toBeVisible();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('system')).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/admin/stats/dashboard');

    fireEvent.click(within(link).getByText('test-user'));
    await screen.findByText('statisticsNotes');
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(screen.getByText('unattributed')).not.toBeVisible();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(3));
    expect(String(vi.mocked(get).mock.calls[1][0])).toContain('/admin/stats/ai-usage?');

    fireEvent.click(screen.getByText('back'));
    await screen.findByRole('link', { name: 'aiUsage.viewDetails' });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows an empty ranking with a working details entry', async () => {
    vi.mocked(get).mockResolvedValue({ data: { ...dashboard, topUsersByTokenUsage: [] } });
    mount();
    const link = await screen.findByRole('link', { name: 'aiUsage.viewDetails' });
    expect(within(link).getByText('empty.noTokenUsage')).toBeVisible();
    expect(link).toHaveAttribute('href', '/admin/ai-usage');
  });

  it.each(['admin', 'super_admin'])('allows %s to open details directly', async (role) => {
    vi.mocked(useAuthState).mockReturnValue({ authReady: true, profile: { role } } as ReturnType<
      typeof useAuthState
    >);
    mount('/admin/ai-usage');
    await screen.findByText('statisticsNotes');
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByText('back'));
    await waitFor(() => expect(get).toHaveBeenCalledWith('/admin/stats/dashboard'));
  });

  it.each([null, { role: 'user' }])(
    'blocks non-admin details without fetching usage',
    (profile) => {
      vi.mocked(useAuthState).mockReturnValue({ authReady: true, profile } as ReturnType<
        typeof useAuthState
      >);
      mount('/admin/ai-usage');
      expect(screen.getByText('accessDenied')).toBeVisible();
      expect(get).not.toHaveBeenCalled();
    }
  );

  it('waits for authentication before fetching details', () => {
    vi.mocked(useAuthState).mockReturnValue({
      authReady: false,
      profile: undefined,
      tokenValid: true,
      isAuthPending: true,
      isAuthenticated: false,
    });
    mount('/admin/ai-usage');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('accessDenied')).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});
