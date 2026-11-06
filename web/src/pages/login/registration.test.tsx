import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { authService } from '@/utils/auth';
import Login from './index';

const { get, post, getSiteStatus, registerWithPasskey, authenticateWithPasskey, state } =
  vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
    getSiteStatus: vi.fn(),
    registerWithPasskey: vi.fn(),
    authenticateWithPasskey: vi.fn(),
    state: { passkeySupported: true, allowRegistration: true, modernEnabled: true },
  }));

vi.unmock('react-dom/client');
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
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
  registerWithPasskey,
  authenticateWithPasskey,
  registerPasskey: vi.fn(),
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
  getSiteStatus.mockImplementation(async () => ({
    data: {
      passkey: { enabled: state.modernEnabled },
      frontendConfig: { safeRoutes: ['login'] },
      ui: { allowRegistration: state.allowRegistration },
      oauth: {
        enabled: state.modernEnabled,
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
              enabled: state.modernEnabled,
              providers: { github: { enabled: true }, apple: { enabled: true } },
            },
          },
  }));
  post.mockResolvedValue({ data: tokens });
  registerWithPasskey.mockResolvedValue(tokens);
});

afterEach(cleanup);

describe('passwordless registration', () => {
  it('makes modern sign-in visible while keeping password fields behind other ways', async () => {
    renderLogin();
    expect(await screen.findByRole('button', { name: 'passkey.loginWithPasskey' })).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'entry.continueWithProvider' })).toHaveLength(2);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'entry.otherWays' }));
    expect(screen.getByLabelText('fields.usernameOrEmail')).toBeVisible();
    expect(screen.getByLabelText('fields.password')).toBeVisible();
  });

  it('creates a Passkey account by submitting only username and preserves the requested destination', async () => {
    renderLogin();
    fireEvent.click(await screen.findByRole('button', { name: 'entry.createWithPasskey' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.queryByLabelText('fields.email')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('fields.nickname')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('fields.password')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('fields.username'), { target: { value: 'reader' } });
    fireEvent.click(screen.getByRole('button', { name: 'entry.createAccount' }));
    await waitFor(() => expect(registerWithPasskey).toHaveBeenCalledWith({ username: 'reader' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/explore'));
    expect(post).not.toHaveBeenCalled();
  });

  it('keeps cancelled Passkey registration on the username form without authenticating', async () => {
    registerWithPasskey.mockRejectedValue(new DOMException('cancelled', 'NotAllowedError'));
    renderLogin();
    fireEvent.click(await screen.findByRole('button', { name: 'entry.createWithPasskey' }));
    fireEvent.change(screen.getByLabelText('fields.username'), { target: { value: 'reader' } });
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'entry.createAccount' }))
    );
    expect(toast.info).toHaveBeenCalledWith('passkey.cancelled');
    expect(authService.getAccessToken()).toBeNull();
    expect(screen.getByLabelText('fields.username')).toHaveValue('reader');
    expect(screen.getByTestId('location')).toHaveTextContent('/login?redirect=');
  });

  it('localizes a Passkey username conflict and preserves the entered username for retry', async () => {
    registerWithPasskey.mockRejectedValue({
      response: { data: { errorCode: 'username_unavailable' } },
    });
    renderLogin();
    fireEvent.click(await screen.findByRole('button', { name: 'entry.createWithPasskey' }));
    fireEvent.change(screen.getByLabelText('fields.username'), { target: { value: 'reader' } });
    fireEvent.click(screen.getByRole('button', { name: 'entry.createAccount' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('errors.usernameUnavailable'));
    expect(screen.getByLabelText('fields.username')).toHaveValue('reader');
    expect(authService.getAccessToken()).toBeNull();
  });

  it('validates username locally before starting Passkey creation', async () => {
    renderLogin();
    fireEvent.click(await screen.findByRole('button', { name: 'entry.createWithPasskey' }));
    fireEvent.change(screen.getByLabelText('fields.username'), {
      target: { value: 'invalid name' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'entry.createAccount' }));
    expect(toast.error).toHaveBeenCalledWith('usernameFormat');
    expect(registerWithPasskey).not.toHaveBeenCalled();
  });

  it('keeps email and password required only in traditional registration, with no nickname field', async () => {
    renderLogin();
    fireEvent.click(await screen.findByRole('button', { name: 'entry.otherWays' }));
    fireEvent.click(screen.getByRole('button', { name: 'entry.registerWithEmail' }));
    expect(screen.queryByLabelText('fields.nickname')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('fields.username'), { target: { value: 'reader' } });
    fireEvent.change(screen.getByLabelText('fields.email'), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.change(screen.getByLabelText('fields.password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'buttons.register' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/auth/register', {
        username: 'reader',
        email: 'reader@example.com',
        password: 'password123',
      })
    );
    expect(registerWithPasskey).not.toHaveBeenCalled();
  });

  it('retains old-user login while hiding account creation when registration is closed', async () => {
    state.allowRegistration = false;
    renderLogin();
    expect(await screen.findByRole('button', { name: 'passkey.loginWithPasskey' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'entry.createWithPasskey' })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'entry.otherWays' }));
    expect(screen.getByRole('button', { name: 'buttons.login' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'entry.registerWithEmail' })
    ).not.toBeInTheDocument();
  });

  it('uses traditional login directly when modern methods are unavailable', async () => {
    state.modernEnabled = false;
    renderLogin();
    expect(await screen.findByLabelText('fields.usernameOrEmail')).toBeVisible();
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
    expect(
      screen.queryByRole('button', { name: 'entry.createWithPasskey' })
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
    expect(await screen.findByLabelText('fields.usernameOrEmail')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'passkey.loginWithPasskey' })
    ).not.toBeInTheDocument();
  });

  it('hides unsupported Passkey controls while keeping OAuth available', async () => {
    state.passkeySupported = false;
    renderLogin();
    expect(
      await screen.findAllByRole('button', { name: 'entry.continueWithProvider' })
    ).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: 'passkey.loginWithPasskey' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'entry.createWithPasskey' })
    ).not.toBeInTheDocument();
  });

  it('shows only a prefilled username after OAuth authorization and lets a conflict be corrected', async () => {
    post.mockRejectedValue({ response: { data: { errorCode: 'username_unavailable' } } });
    renderLogin('/login?oauth=register&registrationToken=pending&redirect=%2Fexplore');
    expect(await screen.findByLabelText('fields.username')).toHaveValue('reader');
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.queryByLabelText('fields.email')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'entry.createAccount' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('errors.usernameUnavailable'));
    expect(post).toHaveBeenCalledWith('/auth/register/oauth', {
      registrationToken: 'pending',
      username: 'reader',
    });
    fireEvent.change(screen.getByLabelText('fields.username'), { target: { value: 'reader_2' } });
    fireEvent.click(screen.getByRole('button', { name: 'entry.createAccount' }));
    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith('/auth/register/oauth', {
        registrationToken: 'pending',
        username: 'reader_2',
      })
    );
    expect(authService.getAccessToken()).toBeNull();
  });
});
