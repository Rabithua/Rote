import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UserBlockMenu from './UserBlockMenu';
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

describe('UserBlockMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(refreshBlockAffectedCaches).mockResolvedValue();
  });

  it('keeps blocking inside the actions menu and opens the confirmation dialog', async () => {
    vi.mocked(blockUser).mockResolvedValue({
      blocked: true,
      targetUserId: 'target-id',
    });

    render(<UserBlockMenu blocked={false} targetDisplayName="Target" targetUserId="target-id" />);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'menuAria' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'block' }));

    expect(blockUser).not.toHaveBeenCalled();
    expect(screen.getByText('confirmDescription')).toBeInTheDocument();
    expect(screen.queryByText('publicContentNotice')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    await waitFor(() => expect(blockUser).toHaveBeenCalledWith('target-id'));
    expect(refreshBlockAffectedCaches).toHaveBeenCalledTimes(1);
  });

  it('unblocks directly from the actions menu', async () => {
    vi.mocked(unblockUser).mockResolvedValue({
      blocked: false,
      targetUserId: 'target-id',
    });

    render(<UserBlockMenu blocked targetDisplayName="Target" targetUserId="target-id" />);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'menuAria' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'unblock' }));

    await waitFor(() => expect(unblockUser).toHaveBeenCalledWith('target-id'));
    expect(refreshBlockAffectedCaches).toHaveBeenCalledTimes(1);
  });

  it('waits for the local state transition before refreshing shared caches', async () => {
    vi.mocked(unblockUser).mockResolvedValue({
      blocked: false,
      targetUserId: 'target-id',
    });
    let resolveChanged: (() => void) | undefined;
    const onChanged = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveChanged = resolve;
        })
    );

    render(
      <UserBlockMenu
        blocked
        targetDisplayName="Target"
        targetUserId="target-id"
        onChanged={onChanged}
      />
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'menuAria' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'unblock' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(false));
    expect(refreshBlockAffectedCaches).not.toHaveBeenCalled();

    resolveChanged?.();

    await waitFor(() => expect(refreshBlockAffectedCaches).toHaveBeenCalledTimes(1));
  });
});
