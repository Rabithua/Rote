import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Rote } from '@/types/main';
import FilterPage from './index';

const mocks = vi.hoisted(() => ({
  aiSearch: vi.fn(),
  del: vi.fn(),
  getRotesV2: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ capabilities: { 'ai.chat': { allowed: true } } }),
}));
vi.mock('@/hooks/useSiteStatus', () => ({
  useSiteStatus: () => ({ data: { ai: { memoryAvailable: true } } }),
}));
vi.mock('@/utils/aiApi', () => ({ aiSearch: mocks.aiSearch }));
vi.mock('@/utils/roteApi', () => ({ getRotesV2: mocks.getRotesV2 }));
vi.mock('@/utils/api', () => ({
  get: vi.fn().mockResolvedValue({ data: { roteCount: 1, attachmentCount: 0 } }),
  post: mocks.post,
  put: mocks.put,
  del: mocks.del,
}));
vi.mock('@/state/profile', async () => {
  const { atom } = await import('jotai');
  return {
    profileAtom: atom({ id: 'owner-id', username: 'owner', nickname: 'Owner' }),
  };
});
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: true }),
}));
vi.mock('sonner', () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/layout/ContainerWithSideBar', () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/components/layout/navBar', () => ({
  default: ({ children }: { children: ReactNode }) => <header>{children}</header>,
}));
vi.mock('@/components/ui/date-picker', () => ({ DatePicker: () => null }));
vi.mock('@/components/rote/PostMedia', () => ({ default: () => null }));
vi.mock('@/components/rote/Reactions', () => ({ ReactionsPart: () => null }));
vi.mock('@/components/rote/NoticeCreateBoard', () => ({ default: () => null }));
vi.mock('@/features/note-sharing/NoteShareDialog', () => ({ NoteShareDialog: () => null }));
vi.mock('@/hooks/useNoteExport', () => ({
  useNoteExport: () => ({ exporting: false, handleExportImage: vi.fn() }),
}));
vi.mock('@/components/editor/RoteEditor', () => ({
  default: ({ callback }: { callback: () => void }) => (
    <button
      type="button"
      onClick={async () => {
        await mocks.put('/notes/note-id', { content: 'Edited semantic note' });
        callback();
      }}
    >
      save edit
    </button>
  ),
}));

const makeNote = (): Rote => ({
  id: 'note-id',
  authorid: 'owner-id',
  tags: [],
  content: 'Semantic note',
  state: 'private',
  archived: false,
  pin: false,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  author: { username: 'owner', nickname: 'Owner', avatar: '' },
  attachments: [],
  reactions: [],
});

let notes: Rote[];

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  notes = [makeNote()];
  mocks.getRotesV2.mockResolvedValue([]);
  mocks.aiSearch.mockImplementation(async () =>
    notes.map((note) => ({ sourceType: 'rote', sourceId: note.id, metadata: {} }))
  );
  mocks.post.mockImplementation(async (_url: string, { ids }: { ids: string[] }) => ({
    data: notes.filter((note) => ids.includes(note.id)),
  }));
  mocks.put.mockImplementation(async (_url: string, patch: Partial<Rote>) => {
    notes = notes.map((note) => ({ ...note, ...patch }));
    return { data: notes[0] };
  });
  mocks.del.mockImplementation(async () => {
    notes = [];
    return {};
  });
});

async function renderSemanticSearch() {
  render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <MemoryRouter initialEntries={[{ pathname: '/filter', state: { initialKeyword: '设计' } }]}>
        <FilterPage />
      </MemoryRouter>
    </SWRConfig>
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'search' })).toBeEnabled());
  fireEvent.click(screen.getByText('searchMode.semantic'));
  await screen.findByText('Semantic note');
}

async function openActions() {
  fireEvent.pointerDown(await screen.findByRole('button', { name: 'actions' }), {
    button: 0,
    ctrlKey: false,
  });
  await screen.findByRole('menuitem', { name: 'details' });
}

describe('semantic search note actions', () => {
  it('shows the owned note menu with the usual actions', async () => {
    await renderSemanticSearch();
    await openActions();

    for (const action of ['pinned', 'edit', 'archive', 'share', 'exportImage', 'delete']) {
      expect(screen.getByRole('menuitem', { name: action })).toBeInTheDocument();
    }
  });

  it.each([
    { action: 'pinned', field: 'pin', updatedAction: 'unpinned' },
    { action: 'archive', field: 'archived', updatedAction: 'unarchive' },
  ])(
    'refreshes $field after the menu action succeeds',
    async ({ action, field, updatedAction }) => {
      await renderSemanticSearch();
      await openActions();
      fireEvent.click(screen.getByRole('menuitem', { name: action }));

      await waitFor(() =>
        expect(mocks.put).toHaveBeenCalledWith(
          '/notes/note-id',
          expect.objectContaining({ [field]: true })
        )
      );
      await waitFor(() => expect(mocks.aiSearch).toHaveBeenCalledTimes(2));
      await openActions();
      expect(screen.getByRole('menuitem', { name: updatedAction })).toBeInTheDocument();
      expect(mocks.post).toHaveBeenCalledTimes(2);
    }
  );

  it('removes a deleted result after confirmation and refresh', async () => {
    await renderSemanticSearch();
    await openActions();
    fireEvent.click(screen.getByRole('menuitem', { name: 'delete' }));

    expect(mocks.del).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'messages.confirmDelete' }));

    await screen.findByText('semantic.empty');
    expect(mocks.del).toHaveBeenCalledWith('/notes/note-id');
    expect(mocks.aiSearch).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Semantic note')).not.toBeInTheDocument();
  });

  it('refreshes the result after editing succeeds', async () => {
    await renderSemanticSearch();
    await openActions();
    fireEvent.click(screen.getByRole('menuitem', { name: 'edit' }));
    fireEvent.click(await screen.findByRole('button', { name: 'save edit' }));

    await screen.findByText('Edited semantic note');
    expect(mocks.aiSearch).toHaveBeenCalledTimes(2);
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
