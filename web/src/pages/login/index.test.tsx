import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from '@/utils/auth';
import Login from './index';

const { get, post, authenticateWithPasskey, authorizeRender, translate } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  authenticateWithPasskey: vi.fn(),
  authorizeRender: vi.fn(),
  translate: (key: string) => key,
}));

vi.unmock('react-dom/client');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translate, i18n: { language: 'en' } }),
}));
vi.mock('@/utils/api', () => ({ get, post, getApiUrl: () => '/v2/api' }));
vi.mock('@/utils/setupApi', () => ({
  getSiteStatus: async () => ({ data: { passkey: { enabled: true } } }),
}));
vi.mock('@/utils/passkey', () => ({
  authenticateWithPasskey,
  registerPasskey: vi.fn(),
  registerWithPasskey: vi.fn(),
  listPasskeys: vi.fn(),
  deletePasskey: vi.fn(),
}));
vi.mock('@/components/others/LoadingPlaceholder', () => ({
  default: () => <div role="status">loading</div>,
}));
vi.mock('./components/StandardLoginPanel', () => ({
  StandardLoginPanel: ({
    loginData,
    onLoginFieldChange,
    onLogin,
    onPasskeyLogin,
  }: ComponentProps<typeof import('./components/StandardLoginPanel').StandardLoginPanel>) => (
    <div>
      <input
        aria-label="username"
        value={loginData.username}
        onChange={(event) => onLoginFieldChange('username', event.target.value)}
      />
      <input
        aria-label="password"
        value={loginData.password}
        onChange={(event) => onLoginFieldChange('password', event.target.value)}
      />
      <button onClick={onLogin}>password login</button>
      <button onClick={onPasskeyLogin}>passkey login</button>
    </div>
  ),
}));
vi.mock('./components/IosAuthorizePanel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./components/IosAuthorizePanel')>();
  return {
    IosAuthorizePanel: (props: ComponentProps<typeof actual.IosAuthorizePanel>) => {
      authorizeRender();
      return <actual.IosAuthorizePanel {...props} />;
    },
  };
});

const tokens = {
  accessToken: `header.${btoa(JSON.stringify({ exp: 4102444800 }))}.signature`,
  refreshToken: 'test-refresh-token',
};

function CurrentLocation() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderLogin(path = '/login?type=ioslogin', cachedProfile = false) {
  const cache = new Map();
  if (cachedProfile) {
    cache.set('/users/me/profile', {
      data: { username: 'reader', nickname: 'Reader' },
      isLoading: false,
    });
    cache.set('checkStatus', { data: { isInitialized: true }, isLoading: false });
  }
  return render(
    <SWRConfig
      value={{ provider: () => cache, shouldRetryOnError: false, revalidateOnFocus: false }}
    >
      <MemoryRouter initialEntries={[path]}>
        <Login />
        <CurrentLocation />
      </MemoryRouter>
    </SWRConfig>
  );
}

async function loginWithPassword() {
  fireEvent.change(screen.getByLabelText('username'), { target: { value: 'reader' } });
  fireEvent.change(screen.getByLabelText('password'), { target: { value: 'password123' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'password login' })));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  get.mockImplementation(async (path: string) => ({
    data:
      path === '/users/me/profile'
        ? { username: 'reader', nickname: 'Reader' }
        : { isInitialized: true },
  }));
  post.mockResolvedValue({ data: tokens });
  authenticateWithPasskey.mockResolvedValue(tokens);
});

afterEach(cleanup);

describe('iOS login handoff', () => {
  it('keeps the explicit account authorization when arriving with an existing session', async () => {
    authService.setTokens(tokens.accessToken, tokens.refreshToken);
    renderLogin();

    expect(await screen.findByRole('button', { name: 'authorize.button' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'authorize.switchAccount' })).toBeInTheDocument();
    expect(authorizeRender).toHaveBeenCalled();
  });

  it('shows loading after password login while the custom scheme leaves the page mounted', async () => {
    renderLogin();
    await screen.findByRole('button', { name: 'password login' });

    await loginWithPassword();

    await waitFor(() => expect(authService.getAccessToken()).toBe(tokens.accessToken));
    expect(authorizeRender).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('loading');
    expect(screen.queryByRole('button', { name: 'authorize.button' })).not.toBeInTheDocument();
  });

  it('shows loading after Passkey login even when the profile becomes available', async () => {
    renderLogin();
    await screen.findByRole('button', { name: 'passkey login' });

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'passkey login' })));

    await waitFor(() => expect(authService.getAccessToken()).toBe(tokens.accessToken));
    expect(authorizeRender).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('loading');
  });

  it('never renders the authorization panel on an iOS OAuth success callback, including its first frame', async () => {
    authService.setTokens(tokens.accessToken, tokens.refreshToken);
    const query = new URLSearchParams({
      type: 'ioslogin',
      oauth: 'success',
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    renderLogin(`/login?${query}`, true);

    const initialAuthorizeCalls = authorizeRender.mock.calls.length;
    await act(async () => {});
    expect(initialAuthorizeCalls).toBe(0);
    expect(authorizeRender).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('loading');
  });

  it('continues navigating ordinary web logins to their requested destination', async () => {
    renderLogin('/login?redirect=%2Fexplore');
    await screen.findByRole('button', { name: 'password login' });

    await loginWithPassword();

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/explore'));
    expect(authorizeRender).not.toHaveBeenCalled();
  });
});
