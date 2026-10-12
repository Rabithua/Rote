import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  mockAllIsIntersecting,
  resetIntersectionMocking,
  setupIntersectionMocking,
} from 'react-intersection-observer/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Reaction, Rote } from '@/types/main';
import { generateVisitorId } from '@/utils/deviceFingerprint';

import { ReactionsPart } from './Reactions';
import RoteItem from './roteItem';

const mocks = vi.hoisted(() => ({
  isAuthenticated: false,
  visitorId: 'visitor-current' as string | null,
  anonymousPreReactions: ['❤️', '👍'] as string[],
  post: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@/components/editor/RoteEditor', () => ({ default: () => null }));
vi.mock('@/components/rote/RoteActionsMenu', () => ({ default: () => null }));
vi.mock('@/components/rote/PostMedia', () => ({ default: () => null }));
vi.mock('@/components/rote/NoticeCreateBoard', () => ({ default: () => null }));
vi.mock('@/features/note-sharing/NoteShareDialog', () => ({ NoteShareDialog: () => null }));
vi.mock('@/state/editor', () => ({ useEditor: () => ({ editor_editRoteAtom: {} }) }));

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
  profileAtom: {},
  useAuthState: () => ({
    authReady: true,
    isAuthenticated: mocks.isAuthenticated,
    isAuthPending: false,
    profile: mocks.isAuthenticated ? { id: 'user-current' } : undefined,
  }),
}));

vi.mock('@/state/visitorId', () => ({ visitorIdAtom: {} }));
vi.mock('jotai', () => ({
  useAtom: () => [mocks.visitorId, vi.fn()],
  useAtomValue: () => undefined,
}));
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
    setupIntersectionMocking(vi.fn);
    mocks.visitorId = 'visitor-current';
    mocks.anonymousPreReactions = ['❤️', '👍'];
    mocks.post.mockReset();
    mocks.del.mockReset();
    vi.mocked(generateVisitorId).mockClear();
  });

  afterEach(() => {
    resetIntersectionMocking();
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

  it('defers visitor identity initialization until visible while keeping reaction content', async () => {
    mocks.visitorId = null;
    const rote = makeRote([makeReaction({ type: 'existing-reaction' })]);
    const view = (isInView: boolean) => (
      <MemoryRouter>
        <ReactionsPart rote={rote} isInView={isInView} />
      </MemoryRouter>
    );
    const { rerender } = render(view(false));

    await act(async () => undefined);
    expect(screen.getByText('existing-reaction')).toBeInTheDocument();
    expect(generateVisitorId).not.toHaveBeenCalled();

    rerender(view(true));
    await waitFor(() => expect(generateVisitorId).toHaveBeenCalledTimes(1));
    expect(screen.getByText('existing-reaction')).toBeInTheDocument();

    rerender(view(false));
    rerender(view(true));
    await act(async () => undefined);
    expect(generateVisitorId).toHaveBeenCalledTimes(1);
  });

  it('renders actual reaction counts before the card enters view and preserves their nodes', () => {
    const rote = makeRote([
      makeReaction({ id: 'reaction-1', type: 'existing-reaction' }),
      makeReaction({ id: 'reaction-2', type: 'existing-reaction' }),
    ]);
    const view = (note: Rote) => (
      <MemoryRouter>
        <RoteItem rote={note} showAvatar={false} />
      </MemoryRouter>
    );
    const { rerender } = render(view(rote));
    const reaction = screen.getByText('existing-reaction');
    const count = screen.getByText('2');

    for (const inView of [true, false, true]) {
      act(() => mockAllIsIntersecting(inView));
      expect(screen.getByText('existing-reaction')).toBe(reaction);
      expect(screen.getByText('2')).toBe(count);
    }

    rerender(
      view({
        ...rote,
        reactions: [
          ...rote.reactions,
          makeReaction({ id: 'reaction-3', type: 'existing-reaction' }),
        ],
      })
    );
    expect(screen.getByText('3')).toBe(count);
  });

  it('keeps a custom reaction draft and focus when the card leaves and re-enters view', () => {
    vi.useFakeTimers();
    mocks.isAuthenticated = true;
    const rote = makeRote();
    const view = (
      <MemoryRouter>
        <RoteItem rote={rote} showAvatar={false} />
      </MemoryRouter>
    );
    render(view);
    act(() => mockAllIsIntersecting(true));

    fireEvent.pointerDown(screen.getByRole('button'), { button: 0, pointerType: 'touch' });
    act(() => vi.advanceTimersByTime(2_000));
    fireEvent.pointerUp(screen.getByPlaceholderText('placeholder'));
    const input = screen.getByPlaceholderText('placeholder');
    fireEvent.change(input, { target: { value: 'draft reaction' } });

    for (const inView of [false, true]) {
      act(() => mockAllIsIntersecting(inView));
      expect(screen.getByPlaceholderText('placeholder')).toBe(input);
      expect(input).toHaveValue('draft reaction');
      expect(input).toHaveFocus();
    }
  });

  it('keeps an in-flight reaction disabled across viewport changes', async () => {
    mocks.isAuthenticated = true;
    const rote = makeRote([makeReaction({ type: 'existing-reaction', userid: 'other-user' })]);
    let finishRequest!: (_response: { data: Reaction }) => void;
    mocks.post.mockReturnValue(
      new Promise((resolve) => {
        finishRequest = resolve;
      })
    );
    render(
      <MemoryRouter>
        <RoteItem rote={rote} showAvatar={false} />
      </MemoryRouter>
    );
    act(() => mockAllIsIntersecting(true));
    fireEvent.click(screen.getByText('existing-reaction'));
    expect(mocks.post).toHaveBeenCalledTimes(1);

    act(() => mockAllIsIntersecting(false));
    act(() => mockAllIsIntersecting(true));
    fireEvent.click(screen.getByText('existing-reaction'));
    expect(mocks.post).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishRequest({ data: makeReaction({ type: 'existing-reaction', userid: 'user-current' }) });
    });
  });
});
