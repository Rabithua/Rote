import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from '@dr.pogodin/react-helmet';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SharedNotePage from './SharedNotePage';
import { getSharedNote } from './api';
import type { SharedNote } from './types';

vi.mock('./api', () => ({ getSharedNote: vi.fn() }));

const note: SharedNote = {
  title: 'A shared thought',
  content: 'Readable without signing in',
  tags: ['family'],
  createdAt: '2026-09-06T12:00:00Z',
  updatedAt: '2026-09-06T12:00:00Z',
  author: { username: 'author', nickname: 'Author', avatar: null },
  attachments: [],
  linkPreviews: [],
  article: { content: '# Article in full\n\nArticle body', createdAt: '', updatedAt: '' },
};

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/s/test-token']}>
        <Routes>
          <Route path="/s/:token" element={<SharedNotePage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('anonymous share reader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSharedNote).mockResolvedValue(note);
  });

  it('renders the article inline and keeps tags and reading independent of account routes', async () => {
    renderPage();
    expect(await screen.findByText(note.content)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Article in full' })).toBeInTheDocument();
    expect(screen.getByText('Article body')).toBeInTheDocument();
    expect(screen.getByText('family').closest('a')).toBeNull();
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '#shared-note',
      '#shared-article',
    ]);
    expect(screen.getByText('@author')).toBeInTheDocument();
    expect(screen.queryByText('back')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit|delete|reaction/ })).not.toBeInTheDocument();
  });

  it('refreshes changed content on focus and clears already-read content after revocation', async () => {
    renderPage();
    await screen.findByText(note.content);
    vi.mocked(getSharedNote).mockResolvedValueOnce({ ...note, content: 'Latest edit' });
    fireEvent.focus(window);
    await screen.findByText('Latest edit');
    vi.mocked(getSharedNote).mockRejectedValueOnce({ response: { status: 404 } });
    fireEvent.focus(window);
    await screen.findByText('unavailableTitle');
    expect(screen.queryByText('Latest edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Article body')).not.toBeInTheDocument();
    expect(screen.queryByText('@author')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'article' })).not.toBeInTheDocument();
  });

  it('shows retry for a network failure and fetches again', async () => {
    vi.mocked(getSharedNote).mockRejectedValueOnce(new Error('offline'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'retry' }));
    expect(await screen.findByText(note.content)).toBeInTheDocument();
  });

  it('revalidates when the browser restores the page', async () => {
    renderPage();
    await screen.findByText(note.content);
    vi.mocked(getSharedNote).mockRejectedValueOnce({ response: { status: 404 } });
    fireEvent(window, new Event('pageshow'));
    await screen.findByText('unavailableTitle');
    expect(screen.queryByText(note.content)).not.toBeInTheDocument();
  });

  it('ignores a stale in-flight response after a newer check reports revocation', async () => {
    let resolveOld!: (value: SharedNote) => void;
    vi.mocked(getSharedNote).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        })
    );
    renderPage();
    await waitFor(() => expect(getSharedNote).toHaveBeenCalledOnce());
    vi.mocked(getSharedNote).mockRejectedValueOnce({ response: { status: 404 } });
    fireEvent.focus(window);
    await screen.findByText('unavailableTitle');
    await act(async () => {
      resolveOld(note);
    });
    expect(screen.queryByText(note.content)).not.toBeInTheDocument();
    expect(screen.getByText('unavailableTitle')).toBeInTheDocument();
  });
});
