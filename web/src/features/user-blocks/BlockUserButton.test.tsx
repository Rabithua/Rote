import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import BlockUserButton from './BlockUserButton';
import { blockUser, unblockUser } from './api';
import { refreshBlockAffectedCaches } from './cache';

vi.mock('./api', () => ({
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
}));

vi.mock('./cache', async (importOriginal) => {
  const original = await importOriginal<typeof import('./cache')>();
  return {
    ...original,
    refreshBlockAffectedCaches: vi.fn(),
  };
});

describe('BlockUserButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(refreshBlockAffectedCaches).mockResolvedValue();
  });

  it('requires confirmation before blocking and refreshes affected caches on success', async () => {
    vi.mocked(blockUser).mockResolvedValue({
      blocked: true,
      targetUserId: 'target-id',
    });
    const onChanged = vi.fn();

    render(
      <BlockUserButton
        blocked={false}
        targetDisplayName="Target"
        targetUserId="target-id"
        onChanged={onChanged}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'blockAria' }));
    expect(blockUser).not.toHaveBeenCalled();
    expect(screen.getByText('confirmDescription')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    await waitFor(() => expect(blockUser).toHaveBeenCalledWith('target-id'));
    expect(onChanged).toHaveBeenCalledWith(true);
    expect(refreshBlockAffectedCaches).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('blockSuccess');
    expect(screen.getByRole('button', { name: 'unblockAria' })).toBeInTheDocument();
  });

  it('rolls the optimistic state back when the server mutation fails', async () => {
    vi.mocked(blockUser).mockRejectedValue(new Error('offline'));

    render(<BlockUserButton blocked={false} targetDisplayName="Target" targetUserId="target-id" />);

    fireEvent.click(screen.getByRole('button', { name: 'blockAria' }));
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'blockAria' })).toBeInTheDocument();
    expect(refreshBlockAffectedCaches).not.toHaveBeenCalled();
  });

  it('keeps the server-confirmed state when cache refresh fails', async () => {
    vi.mocked(blockUser).mockResolvedValue({
      blocked: true,
      targetUserId: 'target-id',
    });
    vi.mocked(refreshBlockAffectedCaches).mockRejectedValue(new Error('cache unavailable'));

    render(<BlockUserButton blocked={false} targetDisplayName="Target" targetUserId="target-id" />);

    fireEvent.click(screen.getByRole('button', { name: 'blockAria' }));
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('refreshFailed'));
    expect(toast.success).toHaveBeenCalledWith('blockSuccess');
    expect(screen.getByRole('button', { name: 'unblockAria' })).toBeInTheDocument();
  });

  it('unblocks without a second confirmation', async () => {
    vi.mocked(unblockUser).mockResolvedValue({
      blocked: false,
      targetUserId: 'target-id',
    });
    const onChanged = vi.fn();

    render(
      <BlockUserButton
        blocked
        targetDisplayName="Target"
        targetUserId="target-id"
        onChanged={onChanged}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'unblockAria' }));

    await waitFor(() => expect(unblockUser).toHaveBeenCalledWith('target-id'));
    expect(onChanged).toHaveBeenCalledWith(false);
    expect(screen.getByRole('button', { name: 'blockAria' })).toBeInTheDocument();
  });
});
