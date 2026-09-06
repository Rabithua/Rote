import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from '@dr.pogodin/react-helmet';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createStore, Provider } from 'jotai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authReadyAtom, profileAtom } from '@/state/profile';
import { get } from '@/utils/api';
import type { Profile } from '@/types/main';
import SharedNotePage from './SharedNotePage';
import { getSharedNote } from './api';
import type { SharedNote } from './types';

vi.mock('./api', () => ({ getSharedNote: vi.fn() }));
vi.mock('@/utils/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/api')>()),
  get: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) =>
      key === 'sharedBy' ? `Shared by ${values?.name}` : key,
    i18n: { language: 'en' },
  }),
}));

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

function renderPage(profile?: Profile, authReady = false) {
  const store = createStore();
  store.set(profileAtom, profile);
  store.set(authReadyAtom, authReady);
  return render(
    <Provider store={store}>
      <HelmetProvider>
        <MemoryRouter initialEntries={['/s/test-token']}>
          <Routes>
            <Route path="/s/:token" element={<SharedNotePage />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    </Provider>
  );
}

describe('anonymous share reader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(getSharedNote).mockResolvedValue(note);
  });

  it('renders the article inline and keeps tags and reading independent of account routes', async () => {
    renderPage();
    expect(await screen.findByText(note.content)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Article in full' })).toBeInTheDocument();
    expect(screen.getByText('Article body')).toBeInTheDocument();
    expect(screen.getByText('family').closest('a')).toBeNull();
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/login',
      '/author',
      '/author',
      '/author',
    ]);
    expect(screen.getByRole('link', { name: 'leftNavBar.login' })).toBeInTheDocument();
    expect(screen.getByText('Shared by Author')).toBeInTheDocument();
    expect(screen.getByText('@author')).toBeInTheDocument();
    expect(screen.queryByText('back')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit|delete|reaction/ })).not.toBeInTheDocument();
  });

  it.each([
    'broken-refresh-token',
    `header.${btoa(JSON.stringify({ exp: 1 }))}.signature`,
    `header.${btoa(JSON.stringify({ userId: 'old-account' }))}.signature`,
  ])('keeps reading and shows login with an unusable stored session: %s', async (token) => {
    localStorage.setItem('rote_refresh_token', token);
    renderPage();
    await screen.findByText(note.content);
    expect(screen.getByRole('link', { name: 'leftNavBar.login' })).toHaveAttribute(
      'href',
      '/login'
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('uses the existing signed-in navigation without starting profile requests', async () => {
    localStorage.setItem(
      'rote_refresh_token',
      `header.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.signature`
    );
    renderPage(undefined, true);
    await screen.findByText(note.content);
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/home',
      '/explore',
      '/ai',
      '/profile',
      '/experiment',
      '/author',
      '/author',
      '/author',
    ]);
    expect(screen.getByText('leftNavBar.logout')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'leftNavBar.login' })).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('keeps the existing role-dependent navigation for an established administrator session', async () => {
    localStorage.setItem(
      'rote_refresh_token',
      `header.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.signature`
    );
    renderPage({ id: 'admin', role: 'admin' } as Profile, true);
    await screen.findByText(note.content);
    expect(screen.getByRole('link', { name: 'leftNavBar.admin' })).toHaveAttribute(
      'href',
      '/admin'
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('uses the username in the header when the author has no nickname', async () => {
    vi.mocked(getSharedNote).mockResolvedValueOnce({
      ...note,
      author: { ...note.author, nickname: null },
    });
    renderPage();
    expect(await screen.findByText('Shared by author')).toBeInTheDocument();
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
    expect(screen.queryByText('Shared by Author')).not.toBeInTheDocument();
    expect(
      screen.queryAllByRole('link').some((link) => link.getAttribute('href') === '/author')
    ).toBe(false);
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
