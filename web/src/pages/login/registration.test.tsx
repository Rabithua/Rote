import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { authService } from '@/utils/auth';
import Login from './index';

const { get, post, getSiteStatus, authenticateWithPasskey, registerPasskey, state } = vi.hoisted(
  () => ({
    get: vi.fn(),
    post: vi.fn(),
    getSiteStatus: vi.fn(),
    authenticateWithPasskey: vi.fn(),
    registerPasskey: vi.fn(),
    state: {
      passkeySupported: true,
      allowRegistration: true,
      modernEnabled: true,
      oauthEnabled: true,
    },
  })
);

vi.unmock('react-dom/client');
// The original animated tabs observe layout, which jsdom does not implement.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  }
);
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { provider?: string }) =>
      options?.provider ? `${key}:${options.provider}` : key,
  }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/utils/api', () => ({
  get,
  post,
  publicGet: get,
  publicPost: post,
  getApiUrl: () => '/v2/api',
}));
vi.mock('@/utils/setupApi', () => ({ getSiteStatus }));
vi.mock('@/utils/passkey', () => ({
  isPasskeySupported: () => state.passkeySupported,
  authenticateWithPasskey,
  registerPasskey,
  listPasskeys: vi.fn(),
  deletePasskey: vi.fn(),
}));

const tokens = {
  accessToken: `header.${btoa(JSON.stringify({ exp: 4102444800 }))}.signature`,
  refreshToken: 'test-refresh-token',
};

function CurrentLocation() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderLogin(path = '/login?redirect=%2Fexplore') {
  return render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        shouldRetryOnError: false,
        revalidateOnFocus: false,
        dedupingInterval: 0,
      }}
    >
      <MemoryRouter initialEntries={[path]}>
        <Login />
        <CurrentLocation />
      </MemoryRouter>
    </SWRConfig>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  state.passkeySupported = true;
  state.allowRegistration = true;
  state.modernEnabled = true;
  state.oauthEnabled = true;
  getSiteStatus.mockImplementation(async () => ({
    data: {
      passkey: { enabled: state.modernEnabled },
      frontendConfig: { safeRoutes: ['login'] },
      ui: { allowRegistration: state.allowRegistration },
      oauth: {
        enabled: state.modernEnabled && state.oauthEnabled,
        providers: { github: { enabled: true }, apple: { enabled: true } },
      },
    },
  }));
  get.mockImplementation(async (path: string) => ({
    data: path.startsWith('/auth/register/oauth/')
      ? { provider: 'github', suggestedUsername: 'reader' }
      : path === '/users/me/profile'
        ? { username: 'reader' }
        : {
            isInitialized: true,
            ui: { allowRegistration: state.allowRegistration },
            oauth: {
              enabled: state.modernEnabled && state.oauthEnabled,
              providers: { github: { enabled: true }, apple: { enabled: true } },
            },
          },
  }));
  post.mockResolvedValue({ data: tokens });
  authenticateWithPasskey.mockResolvedValue(tokens);
});

afterEach(cleanup);

describe('passwordless registration', () => {
  it('offers OAuth first and only Passkey login without any account-creation entry', async () => {
    renderLogin();
    const passkeyLogin = await screen.findByRole('button', { name: 'passkey.loginWithPasskey' });
    const oauthButtons = screen.getAllByRole('button', { name: /^entry.continueWithProvider/ });
    expect(oauthButtons.map((button) => button.textContent)).toEqual([
      'entry.continueWithProvider:Apple',
      'entry.continueWithProvider:GitHub',
    ]);
    expect(oauthButtons[0]).toHaveClass('bg-primary');
    expect(oauthButtons[1]).toHaveClass('border');
    expect(oauthButtons[1]).not.toHaveClass('bg-primary');
    expect(passkeyLogin).toHaveClass('border', 'w-full');
    expect(passkeyLogin).not.toHaveClass('bg-primary');
    expect(screen.getByText('entry.or')).toBeVisible();
    expect(screen.getAllByRole('button')).toHaveLength(4);
    for (const oauthButton of oauthButtons) {
      expect(
        oauthButton.compareDocumentPosition(passkeyLogin) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'entry.otherWays' }));
    await waitFor(() => expect(screen.getByLabelText('fields.usernameOrEmail')).toBeVisible());
    expect(screen.getByLabelText('fields.password')).toBeVisible();
  });

  it('uses the original login/register forms first when OAuth is unavailable but Passkey is enabled', async () => {
    state.oauthEnabled = false;
    renderLogin();

    const username = await screen.findByLabelText('fields.usernameOrEmail');
    expect(username).toBeVisible();
    expect(screen.getByLabelText('fields.password')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'buttons.login' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'buttons.register' })).toBeVisible();
    const passwordLogin = screen.getByRole('button', { name: 'buttons.login' });
    const passkeyLogin = screen.getByRole('button', { name: 'passkey.loginWithPasskey' });
    expect(passwordLogin).toHaveClass('bg-primary');
    expect(passkeyLogin).toHaveClass('border', 'w-full');
    expect(passkeyLogin).not.toHaveClass('bg-primary');
    expect(
      passwordLogin.compareDocumentPosition(passkeyLogin) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getByText('entry.or')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /^entry.continueWithProvider/ })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'entry.otherWays' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'entry.back' })).not.toBeInTheDocument();

    await act(async () =>
      fireEvent.mouseDown(screen.getByRole('tab', { name: 'buttons.register' }), {
        button: 0,
        ctrlKey: false,
      })
    );
    await waitFor(() => expect(screen.getByLabelText('fields.nickname')).toBeVisible());
    expect(screen.getByLabelText('fields.email')).toBeVisible();
    expect(screen.getByRole('button', { name: 'passkey.loginWithPasskey' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'entry.back' })).not.toBeInTheDocument();
  });

  it('keeps secondary Passkey login independent of the empty traditional form without OAuth', async () => {
    state.oauthEnabled = false;
    renderLogin();
    const passkeyLogin = await screen.findByRole('button', { name: 'passkey.loginWithPasskey' });
    expect(screen.getByLabelText('fields.usernameOrEmail')).toHaveValue('');
    expect(screen.getByLabelText('fields.password')).toHaveValue('');

    fireEvent.click(passkeyLogin);

    await waitFor(() => expect(authenticateWithPasskey).toHaveBeenCalledWith());
    expect(post).not.toHaveBeenCalled();
    expect(registerPasskey).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/explore'));
  });

  it('authenticates directly without asking for username and preserves the requested destination', async () => {
    renderLogin();
    fireEvent.click(await screen.findByRole('button', { name: 'passkey.loginWithPasskey' }));
    await waitFor(() => expect(authenticateWithPasskey).toHaveBeenCalledWith());
    expect(registerPasskey).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/explore'));
    expect(post).not.toHaveBeenCalled();
  });

  it('keeps cancelled Passkey login on the main entry without opening registration', async () => {
    authenticateWithPasskey.mockRejectedValue(new DOMException('cancelled', 'NotAllowedError'));
    renderLogin();
    await act(async () =>
      fireEvent.click(await screen.findByRole('button', { name: 'passkey.loginWithPasskey' }))
    );
    expect(toast.info).toHaveBeenCalledWith('passkey.cancelled');
    expect(authService.getAccessToken()).toBeNull();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(registerPasskey).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/login?redirect=');
  });

  it('does not create an account after a Passkey login failure', async () => {
    authenticateWithPasskey.mockRejectedValue(new Error('Device unavailable'));
    renderLogin();
    fireEvent.click(await screen.findByRole('button', { name: 'passkey.loginWithPasskey' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('passkey.loginFailed'));
    expect(registerPasskey).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(authService.getAccessToken()).toBeNull();
  });

  it('retains the original traditional login/register tabs and registration fields', async () => {
    renderLogin();
    fireEvent.click(await screen.findByRole('button', { name: 'entry.otherWays' }));
    expect(screen.getByRole('tab', { name: 'buttons.login' })).toBeVisible();
    await act(async () =>
      fireEvent.mouseDown(screen.getByRole('tab', { name: 'buttons.register' }), {
        button: 0,
        ctrlKey: false,
      })
    );
    await waitFor(() => expect(screen.getByLabelText('fields.nickname')).toBeVisible());
    fireEvent.input(screen.getByLabelText('fields.username'), { target: { value: 'reader' } });
    fireEvent.input(screen.getByLabelText('fields.email'), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.input(screen.getByLabelText('fields.password'), {
      target: { value: 'password123' },
    });
    fireEvent.input(screen.getByLabelText('fields.nickname'), { target: { value: 'Reader' } });
    fireEvent.click(screen.getByRole('button', { name: 'buttons.register' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/auth/register', {
        username: 'reader',
        email: 'reader@example.com',
        password: 'password123',
        nickname: 'Reader',
      })
    );
    expect(registerPasskey).not.toHaveBeenCalled();
  });

  it('keeps direct Passkey login when account registration is closed', async () => {
    state.allowRegistration = false;
    renderLogin();
    expect(await screen.findByRole('button', { name: 'passkey.loginWithPasskey' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'buttons.register' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'passkey.loginWithPasskey' }));
    await waitFor(() => expect(authenticateWithPasskey).toHaveBeenCalledWith());
    expect(registerPasskey).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/explore'));
  });

  it('hides traditional account registration while retaining old-user login when registration is closed', async () => {
    state.allowRegistration = false;
    renderLogin();
    await screen.findByRole('button', { name: 'passkey.loginWithPasskey' });
    fireEvent.click(screen.getByRole('button', { name: 'entry.otherWays' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'buttons.login' })).toBeVisible()
    );
    expect(screen.queryByRole('tab', { name: 'buttons.register' })).not.toBeInTheDocument();
  });

  it('uses traditional login directly when modern methods are unavailable', async () => {
    state.modernEnabled = false;
    renderLogin();
    await waitFor(() => expect(screen.getByLabelText('fields.usernameOrEmail')).toBeVisible());
    expect(screen.queryByRole('button', { name: 'entry.otherWays' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'passkey.loginWithPasskey' })
    ).not.toBeInTheDocument();
  });

  it('waits for site capabilities before rendering sign-in methods', async () => {
    let resolveStatus!: (value: unknown) => void;
    getSiteStatus.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStatus = resolve;
        })
    );
    renderLogin();
    expect(
      screen.queryByRole('button', { name: 'passkey.loginWithPasskey' })
    ).not.toBeInTheDocument();
    await act(async () =>
      resolveStatus({
        data: {
          passkey: { enabled: false },
          ui: { allowRegistration: true },
          oauth: { enabled: false },
        },
      })
    );
    await waitFor(() => expect(screen.getByLabelText('fields.usernameOrEmail')).toBeVisible());
  });

  it('hides unsupported Passkey controls while keeping OAuth available', async () => {
    state.passkeySupported = false;
    renderLogin();
    expect(
      await screen.findAllByRole('button', { name: /^entry.continueWithProvider/ })
    ).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: 'passkey.loginWithPasskey' })
    ).not.toBeInTheDocument();
  });

  it('shows only a prefilled username after OAuth authorization and lets a conflict be corrected', async () => {
    post.mockRejectedValue({ response: { data: { errorCode: 'username_unavailable' } } });
    renderLogin('/login?oauth=register&registrationToken=pending&redirect=%2Fexplore');
    expect(await screen.findByLabelText('fields.username')).toHaveValue('reader');
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.queryByLabelText('fields.email')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'entry.continue' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('errors.usernameUnavailable'));
    expect(post).toHaveBeenCalledWith('/auth/register/oauth', {
      registrationToken: 'pending',
      username: 'reader',
    });
    fireEvent.change(screen.getByLabelText('fields.username'), { target: { value: 'reader_2' } });
    fireEvent.click(screen.getByRole('button', { name: 'entry.continue' }));
    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith('/auth/register/oauth', {
        registrationToken: 'pending',
        username: 'reader_2',
      })
    );
    expect(authService.getAccessToken()).toBeNull();
  });

  it.each([
    ['ordinary web signup', '/explore', false],
    ['iOS signup', '/explore', true],
    ['MCP authorization signup', '/oauth/authorize?requestId=client-request', false],
  ] as const)(
    'completes username-only OAuth registration for %s without enrolling a Passkey',
    async (_scenario, redirect, isIosLogin) => {
      const accountId = 'new-oauth-account';
      const accessToken = `header.${btoa(JSON.stringify({ exp: 4102444800, userId: accountId, username: 'reader' }))}.signature`;
      post.mockResolvedValueOnce({
        data: { ...tokens, accessToken, completionUrl: '/login?oauth=success' },
      });
      const params = new URLSearchParams({
        oauth: 'register',
        registrationToken: 'pending',
        redirect,
        ...(isIosLogin ? { type: 'ioslogin' } : {}),
      });
      renderLogin(`/login?${params}`);
      await screen.findByLabelText('fields.username');

      fireEvent.click(screen.getByRole('button', { name: 'entry.continue' }));

      await waitFor(() => expect(authService.getAccessToken()).toBe(accessToken));
      expect(post).toHaveBeenCalledWith('/auth/register/oauth', {
        registrationToken: 'pending',
        username: 'reader',
      });
      expect(registerPasskey).not.toHaveBeenCalled();
    }
  );
});
