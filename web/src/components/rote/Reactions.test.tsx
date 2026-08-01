import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Reaction, Rote } from '@/types/main';

import { ReactionsPart } from './Reactions';

const mocks = vi.hoisted(() => ({
  isAuthenticated: false,
  visitorId: 'visitor-current' as string | null,
  anonymousPreReactions: ['❤️', '👍'] as string[],
  post: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@/components/animate-ui/text/sliding-number', () => ({
  SlidingNumber: ({ number }: { number: number }) => <span>{number}</span>,
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  AvatarImage: () => null,
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/useSiteStatus', () => ({
  useSiteStatus: () => ({
    data: {
      frontendConfig: {
        preReactions: ['❤️', '👍', '👎'],
        anonymousPreReactions: mocks.anonymousPreReactions,
      },
    },
  }),
}));

vi.mock('@/state/profile', () => ({
  useAuthState: () => ({
    authReady: true,
    isAuthenticated: mocks.isAuthenticated,
    isAuthPending: false,
    profile: mocks.isAuthenticated ? { id: 'user-current' } : undefined,
  }),
}));

vi.mock('@/state/visitorId', () => ({ visitorIdAtom: {} }));
vi.mock('jotai', () => ({ useAtom: () => [mocks.visitorId, vi.fn()] }));
vi.mock('@/utils/api', () => ({
  post: mocks.post,
  del: mocks.del,
}));
vi.mock('@/utils/deviceFingerprint', () => ({
  generateVisitorId: vi.fn(() => new Promise<string>(() => undefined)),
  getVisitorInfo: vi.fn(() => ({})),
}));

const makeRote = (reactions: Reaction[] = []): Rote => ({
  id: 'rote-id',
  tags: [],
  content: 'Reaction test',
  state: 'public',
  archived: false,
  pin: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  author: {
    username: 'author',
    nickname: 'Author',
    avatar: '',
  },
  attachments: [],
  reactions,
});

const makeReaction = (patch: Partial<Reaction>): Reaction => ({
  id: 'reaction-id',
  type: 'custom',
  roteid: 'rote-id',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...patch,
});

function renderReactions(rote = makeRote()) {
  return render(
    <MemoryRouter>
      <ReactionsPart rote={rote} />
    </MemoryRouter>
  );
}

describe('ReactionsPart anonymous access', () => {
  beforeEach(() => {
    mocks.isAuthenticated = false;
    mocks.visitorId = 'visitor-current';
    mocks.anonymousPreReactions = ['❤️', '👍'];
    mocks.post.mockReset();
    mocks.del.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows only the server-provided anonymous presets', () => {
    renderReactions();

    expect(screen.getByText('❤️')).toBeInTheDocument();
    expect(screen.getByText('👍')).toBeInTheDocument();
    expect(screen.queryByText('👎')).not.toBeInTheDocument();
  });

  it('does not open the custom composer on anonymous long press', () => {
    vi.useFakeTimers();
    renderReactions();

    fireEvent.pointerDown(screen.getByRole('button'), { button: 0, pointerType: 'touch' });
    act(() => vi.advanceTimersByTime(2_000));

    expect(screen.queryByPlaceholderText('placeholder')).not.toBeInTheDocument();
  });

  it('keeps another user custom reaction read-only', () => {
    renderReactions(
      makeRote([
        makeReaction({
          user: { username: 'other', nickname: 'Other', avatar: null },
          userid: 'user-other',
        }),
      ])
    );

    fireEvent.click(screen.getByText('custom'));

    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it('does not treat a missing visitor id as ownership', () => {
    mocks.visitorId = null;
    renderReactions(
      makeRote([
        makeReaction({
          user: { username: 'other', nickname: 'Other', avatar: null },
          userid: 'user-other',
          visitorId: null,
        }),
      ])
    );

    expect(screen.getByRole('button')).toBeDisabled();
    fireEvent.click(screen.getByText('custom'));

    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it('hides the anonymous add control for an explicit empty allowlist', () => {
    mocks.anonymousPreReactions = [];
    renderReactions();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('allows an anonymous visitor to remove their own legacy custom reaction', async () => {
    mocks.del.mockResolvedValue({});
    renderReactions(
      makeRote([makeReaction({ id: 'legacy-reaction', visitorId: mocks.visitorId })])
    );

    fireEvent.click(screen.getByText('custom'));

    await waitFor(() =>
      expect(mocks.del).toHaveBeenCalledWith('/reactions/rote-id/custom?visitorId=visitor-current')
    );
  });

  it('keeps the complete picker and custom composer for authenticated users', () => {
    vi.useFakeTimers();
    mocks.isAuthenticated = true;
    renderReactions();

    expect(screen.getByText('👎')).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole('button'), { button: 0, pointerType: 'touch' });
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByPlaceholderText('placeholder')).toBeInTheDocument();
  });
});
