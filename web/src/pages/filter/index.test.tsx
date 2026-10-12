import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FilterPage from './index';

const { aiSearch, getRotesV2, post } = vi.hoisted(() => ({
  aiSearch: vi.fn(),
  getRotesV2: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ capabilities: { 'ai.chat': { allowed: true } } }),
}));
vi.mock('@/hooks/useSiteStatus', () => ({
  useSiteStatus: () => ({ data: { ai: { memoryAvailable: true } } }),
}));
vi.mock('@/utils/aiApi', () => ({ aiSearch }));
vi.mock('@/utils/roteApi', () => ({ getRotesV2 }));
vi.mock('@/utils/api', () => ({
  get: vi.fn().mockResolvedValue({ data: { roteCount: 1, attachmentCount: 0 } }),
  post,
}));
vi.mock('@/layout/ContainerWithSideBar', () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/components/layout/navBar', () => ({
  default: ({ children, onNavClick }: { children: ReactNode; onNavClick: () => void }) => (
    <header onClick={onNavClick}>
      <button type="button">refresh</button>
      {children}
    </header>
  ),
}));
vi.mock('@/components/rote/roteList', () => ({
  default: ({ data, loadMore }: { data?: unknown[][]; loadMore: () => void }) => (
    <div>
      keyword results
      <span>pages:{data?.length ?? 0}</span>
      <button type="button" onClick={loadMore}>
        more
      </button>
    </div>
  ),
}));
vi.mock('@/components/rote/roteItem', () => ({
  default: ({ rote }: { rote: { content: string } }) => <div>{rote.content}</div>,
}));
vi.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({ setDate }: { setDate: (date: Date) => void }) => (
    <button type="button" onClick={() => setDate(new Date('2026-10-02T12:00:00'))}>
      date
    </button>
  ),
}));

afterEach(cleanup);
beforeEach(() => {
  aiSearch.mockReset().mockResolvedValue([]);
  getRotesV2.mockReset().mockResolvedValue([]);
  post.mockReset().mockResolvedValue({ data: [] });
});

async function renderSearch(keyword = '设计') {
  const view = render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <MemoryRouter initialEntries={[{ pathname: '/filter', state: { initialKeyword: keyword } }]}>
        <FilterPage />
      </MemoryRouter>
    </SWRConfig>
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'search' })).toBeEnabled());
  return view;
}

describe('search mode loading', () => {
  it('refreshes cached keyword results when returning from semantic mode', async () => {
    await renderSearch();
    fireEvent.click(screen.getByText('searchMode.semantic'));
    await screen.findByText('semantic.empty');
    getRotesV2.mockClear();

    fireEvent.click(screen.getByText('searchMode.keyword'));
    await waitFor(() => expect(getRotesV2).toHaveBeenCalledTimes(1));
    expect(getRotesV2).toHaveBeenLastCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ skip: 0 }) })
    );
  });

  it('resets pagination and refreshes the first page when returning to a cached query', async () => {
    await renderSearch();
    fireEvent.click(screen.getByText('more'));
    await waitFor(() => expect(getRotesV2).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'search' })).toBeEnabled());
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'GitHub' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await waitFor(() => expect(getRotesV2).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByRole('button', { name: 'search' })).toBeEnabled());
    getRotesV2.mockClear();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '设计' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await waitFor(() => expect(getRotesV2).toHaveBeenCalledTimes(1));
    expect(getRotesV2).toHaveBeenLastCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ keyword: '设计', skip: 0 }) })
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'search' })).toBeEnabled());
    expect(screen.getByText('pages:1')).toBeInTheDocument();
    fireEvent.click(screen.getByText('more'));
    await screen.findByText('pages:2');
    expect(getRotesV2).toHaveBeenCalledTimes(1);
  });

  it.each([{ notes: [] }, { notes: [{ id: 'note', content: '设计' }] }])(
    'shows one result-area spinner when refreshing a finished keyword list (%j)',
    async ({ notes }) => {
      getRotesV2.mockResolvedValue(notes);
      const { container } = await renderSearch();
      let finishRefresh!: (results: typeof notes) => void;
      getRotesV2.mockReturnValue(
        new Promise<typeof notes>((resolve) => {
          finishRefresh = resolve;
        })
      );
      fireEvent.click(screen.getByText('refresh'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'search' })).toBeDisabled());
      expect(container.querySelectorAll('.animate-spin')).toHaveLength(1);
      await act(async () => finishRefresh(notes));
      await waitFor(() => expect(container.querySelectorAll('.animate-spin')).toHaveLength(0));
    }
  );

  it('shows one result-area spinner and keeps the search icon while semantic search is pending', async () => {
    let finishSearch!: (results: []) => void;
    aiSearch.mockReturnValue(
      new Promise<[]>((resolve) => {
        finishSearch = resolve;
      })
    );
    const { container } = await renderSearch();

    fireEvent.click(screen.getByText('searchMode.semantic'));
    await waitFor(() => expect(aiSearch).toHaveBeenCalled());

    expect(container.querySelectorAll('.animate-spin')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'search' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'search' }).querySelector('.lucide-search')
    ).toBeTruthy();
    await act(async () => finishSearch([]));
    await waitFor(() => expect(container.querySelectorAll('.animate-spin')).toHaveLength(0));
  });

  it('starts one semantic request without refreshing the inactive keyword search', async () => {
    await renderSearch();
    const keywordRequests = getRotesV2.mock.calls.length;

    fireEvent.click(screen.getByText('searchMode.semantic'));
    await screen.findByText('semantic.empty');

    expect(aiSearch).toHaveBeenCalledTimes(1);
    expect(getRotesV2).toHaveBeenCalledTimes(keywordRequests);
  });

  it('does not load semantic results for an empty query', async () => {
    const { container } = await renderSearch('');
    fireEvent.click(screen.getByText('searchMode.semantic'));
    await screen.findByText('semantic.emptyQuery');

    expect(aiSearch).not.toHaveBeenCalled();
    expect(container.querySelectorAll('.animate-spin')).toHaveLength(0);
  });

  it('searches once when the date changes and still supports explicit refresh', async () => {
    await renderSearch();
    fireEvent.click(screen.getByText('searchMode.semantic'));
    await screen.findByText('semantic.empty');
    aiSearch.mockClear();

    fireEvent.click(screen.getByText('date'));
    await waitFor(() => expect(aiSearch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'search' })).toBeEnabled());
    expect(aiSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: '设计',
        timeRange: { from: '2026-10-02T00:00:00.000Z', to: '2026-10-02T23:59:59.999Z' },
      })
    );

    fireEvent.click(screen.getByText('refresh'));
    await waitFor(() => expect(aiSearch).toHaveBeenCalledTimes(2));
  });

  it('resets keyword pagination when the submitted query changes', async () => {
    await renderSearch();
    fireEvent.click(screen.getByText('more'));
    await waitFor(() =>
      expect(getRotesV2).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ keyword: '设计', skip: 20 }),
        })
      )
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'search' })).toBeEnabled());
    getRotesV2.mockClear();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'GitHub' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await waitFor(() => expect(getRotesV2).toHaveBeenCalledTimes(1));
    expect(getRotesV2).toHaveBeenLastCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ keyword: 'GitHub', skip: 0 }),
      })
    );
  });
});
