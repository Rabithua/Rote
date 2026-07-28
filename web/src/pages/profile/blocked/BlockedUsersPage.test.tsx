import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BlockedUsersPage from './index';
import { listBlockedUsers, unblockUser } from '@/features/user-blocks/api';
import { refreshBlockAffectedCaches } from '@/features/user-blocks/cache';

vi.mock('@/features/user-blocks/api', () => ({
  blockUser: vi.fn(),
  listBlockedUsers: vi.fn(),
  unblockUser: vi.fn(),
}));

vi.mock('@/features/user-blocks/cache', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/features/user-blocks/cache')>();
  return {
    ...original,
    refreshBlockAffectedCaches: vi.fn(),
  };
});

vi.mock('../components/ProfileSidebar', () => ({
  default: () => <div>profile-sidebar</div>,
}));

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <MemoryRouter>
        <BlockedUsersPage />
      </MemoryRouter>
    </SWRConfig>
  );
}

describe('BlockedUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(refreshBlockAffectedCaches).mockResolvedValue();
  });

  it('loads the complete server list and removes an item after unblock', async () => {
    vi.mocked(listBlockedUsers).mockResolvedValue([
      {
        id: 'target-id',
        username: 'target',
        nickname: 'Target',
        avatar: null,
        description: null,
        certified: false,
        blockedAt: '2026-07-28T08:00:00Z',
      },
    ]);
    vi.mocked(unblockUser).mockResolvedValue({
      blocked: false,
      targetUserId: 'target-id',
    });

    renderPage();

    expect(await screen.findByText('@target')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'unblockAria' }));

    await waitFor(() => expect(unblockUser).toHaveBeenCalledWith('target-id'));
    await waitFor(() => expect(screen.queryByText('@target')).not.toBeInTheDocument());
    expect(refreshBlockAffectedCaches).toHaveBeenCalled();
  });

  it('renders the server-backed empty state', async () => {
    vi.mocked(listBlockedUsers).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('empty')).toBeInTheDocument();
  });
});
