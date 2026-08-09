import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Rote } from '@/types/main';
import { del } from '@/utils/api';

import RoteActionsMenu from './RoteActionsMenu';

vi.mock('@/hooks/useNoteExport', () => ({
  useNoteExport: () => ({
    exporting: false,
    handleExportImage: vi.fn(),
  }),
}));

vi.mock('@/utils/api', () => ({
  del: vi.fn(),
  put: vi.fn(),
}));

const publicNote: Rote = {
  id: 'note-id',
  title: 'Public note',
  tags: [],
  content: 'Visible content',
  state: 'public',
  archived: false,
  authorid: 'target-id',
  pin: false,
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z',
  author: {
    username: 'target',
    nickname: 'Target',
    avatar: '',
  },
  attachments: [],
  reactions: [],
};

describe('RoteActionsMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows block but not owner actions for another user public note', async () => {
    render(
      <MemoryRouter>
        <RoteActionsMenu
          rote={publicNote}
          isOwner={false}
          blockTarget={{
            displayName: 'Target',
            id: 'target-id',
          }}
          onEdit={vi.fn()}
          onShare={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'actions' }), {
      button: 0,
      ctrlKey: false,
    });

    expect(await screen.findByRole('menuitem', { name: 'block' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'details' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'delete' })).not.toBeInTheDocument();
  });

  it('requires confirmation before deleting an owned note', async () => {
    render(
      <MemoryRouter>
        <RoteActionsMenu rote={publicNote} onEdit={vi.fn()} onShare={vi.fn()} />
      </MemoryRouter>
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'actions' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'delete' }));

    expect(del).not.toHaveBeenCalled();
    expect(screen.getByText('messages.deleteConfirmDescription')).toBeInTheDocument();

    const cancelButton = screen.getByRole('dialog').querySelector('[data-slot="dialog-close"]');
    expect(cancelButton).not.toBeNull();
    fireEvent.click(cancelButton!);
    expect(del).not.toHaveBeenCalled();
    expect(screen.queryByText('messages.deleteConfirmDescription')).not.toBeInTheDocument();
  });

  it('deletes the note only after confirmation', async () => {
    vi.mocked(del).mockResolvedValue({} as never);
    const mutate = vi.fn();

    render(
      <MemoryRouter>
        <RoteActionsMenu rote={publicNote} mutate={mutate} onEdit={vi.fn()} onShare={vi.fn()} />
      </MemoryRouter>
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'actions' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'messages.confirmDelete' }));

    await waitFor(() => expect(del).toHaveBeenCalledWith('/notes/note-id'));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('messages.deleteConfirmDescription')).not.toBeInTheDocument();
  });
});
