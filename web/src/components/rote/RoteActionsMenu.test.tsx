import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { Rote } from '@/types/main';

import RoteActionsMenu from './RoteActionsMenu';

vi.mock('@/hooks/useNoteExport', () => ({
  useNoteExport: () => ({
    exporting: false,
    handleExportImage: vi.fn(),
  }),
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
});
