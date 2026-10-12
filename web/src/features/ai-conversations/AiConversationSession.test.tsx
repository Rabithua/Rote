import { render } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AiConversationSession } from './AiConversationSession';

const state = vi.hoisted(() => ({
  userId: 'user-a',
  t: (key: string) => key,
  activate: vi.fn(),
  label: vi.fn(),
}));
vi.mock('@/state/profile', () => ({
  useAuthState: () => ({ tokenValid: true, authReady: false, profile: undefined }),
}));
vi.mock('@/utils/auth', () => ({
  authService: {
    getAccessToken: () => 'token',
    getRefreshToken: () => 'refresh',
    getUserInfoFromToken: () => ({ userId: state.userId }),
  },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: state.t }) }));
vi.mock('@/utils/api', () => ({ getApiUrl: () => 'https://rote.example/v2/api' }));
vi.mock('./runtime', () => ({
  activateAiConversationScope: state.activate,
  setAiConversationInterruptedLabel: state.label,
}));

beforeEach(() => {
  state.activate.mockClear();
  state.label.mockClear();
  state.userId = 'user-a';
});

it('updates translation without cancelling the account scope or its active generation', () => {
  const view = render(<AiConversationSession />);
  expect(state.activate).toHaveBeenCalledTimes(1);
  state.t = (key) => `translated:${key}`;
  view.rerender(<AiConversationSession />);
  expect(state.activate).toHaveBeenCalledTimes(1);
  expect(state.label).toHaveBeenLastCalledWith('translated:messages.interrupted');
  state.userId = 'user-b';
  view.rerender(<AiConversationSession />);
  expect(state.activate).toHaveBeenCalledTimes(3);
  expect(state.activate.mock.calls.at(-1)?.[0].userId).toBe('user-b');
});

it('loads the token-scoped cache before profile networking completes', () => {
  render(<AiConversationSession />);
  expect(state.activate.mock.calls[0][0].userId).toBe('user-a');
});
