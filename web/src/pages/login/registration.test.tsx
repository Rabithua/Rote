import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { authService } from '@/utils/auth';
import Login from './index';

const { get, post, getSiteStatus, continueWithPasskey, state } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  getSiteStatus: vi.fn(),
  continueWithPasskey: vi.fn(),
  state: { passkeySupported: true, allowRegistration: true, modernEnabled: true },
}));

vi.unmock('react-dom/client');
// The original animated tabs observe layout, which jsdom does not implement.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  }
);
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
  continueWithPasskey,
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
  continueWithPasskey.mockResolvedValue(tokens);
});

afterEach(cleanup);

describe('passwordless registration', () => {
  it('offers one combined Passkey entry alongside OAuth and keeps traditional forms behind other ways', async () => {
    renderLogin();
    expect(await screen.findByRole('button', { name: 'entry.continueWithPasskey' })).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'entry.continueWithPasskey' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'entry.continueWithProvider' })).toHaveLength(2);
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(
      screen.queryByRole('button', { name: 'entry.createWithPasskey' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'entry.otherWays' }));
    await waitFor(() => expect(screen.getByLabelText('fields.usernameOrEmail')).toBeVisible());
    expect(screen.getByLabelText('fields.password')).toBeVisible();
  });

  it('continues with a Passkey by submitting only username and preserves the requested destination', async () => {
    renderLogin();
    fireEvent.click(await screen.findByRole('button', { name: 'entry.continueWithPasskey' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.queryByLabelText('fields.email')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('fields.nickname')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('fields.password')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('fields.username'), { target: { value: 'reader' } });
    fireEvent.click(screen.getByRole('button', { name: 'entry.continue' }));
    await waitFor(() => expect(continueWithPasskey).toHaveBeenCalledWith({ username: 'reader' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/explore'));
    expect(post).not.toHaveBeenCalled();
  });

  it('keeps cancelled Passkey continuation on the username form without authenticating', async () => {
    continueWithPasskey.mockRejectedValue(new DOMException('cancelled', 'NotAllowedError'));
    renderLogin();
    fireEvent.click(await screen.findByRole('button', { name: 'entry.continueWithPasskey' }));
    fireEvent.change(screen.getByLabelText('fields.username'), { target: { value: 'reader' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'entry.continue' })));
    expect(toast.info).toHaveBeenCalledWith('passkey.cancelled');
    expect(authService.getAccessToken()).toBeNull();
    expect(screen.getByLabelText('fields.username')).toHaveValue('reader');
    expect(screen.getByTestId('location')).toHaveTextContent('/login?redirect=');
  });

  it('localizes a Passkey username conflict and preserves the entered username for retry', async () => {
    continueWithPasskey.mockRejectedValue({
      response: { data: { errorCode: 'username_unavailable' } },
    });
    renderLogin();
    fireEvent.click(await screen.findByRole('button', { name: 'entry.continueWithPasskey' }));
    fireEvent.change(screen.getByLabelText('fields.username'), { target: { value: 'reader' } });
    fireEvent.click(screen.getByRole('button', { name: 'entry.continue' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('errors.usernameUnavailable'));
    expect(screen.getByLabelText('fields.username')).toHaveValue('reader');
    expect(authService.getAccessToken()).toBeNull();
    continueWithPasskey.mockResolvedValue(tokens);
    fireEvent.change(screen.getByLabelText('fields.username'), { target: { value: 'reader_2' } });
    fireEvent.click(screen.getByRole('button', { name: 'entry.continue' }));
    await waitFor(() =>
      expect(continueWithPasskey).toHaveBeenLastCalledWith({ username: 'reader_2' })
    );
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/explore'));
  });

  it.each([
    ['passkey_not_available', 'errors.passkeyNotAvailable'],
    ['registration_disabled', 'errors.registrationDisabled'],
  ])(
    'keeps %s on the username form without switching to registration or password login',
    async (errorCode, message) => {
      state.allowRegistration = errorCode !== 'registration_disabled';
      continueWithPasskey.mockRejectedValue({ response: { data: { errorCode } } });
      renderLogin();
      fireEvent.click(await screen.findByRole('button', { name: 'entry.continueWithPasskey' }));
      fireEvent.change(screen.getByLabelText('fields.username'), { target: { value: 'reader' } });
      fireEvent.click(screen.getByRole('button', { name: 'entry.continue' }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
      expect(screen.getByLabelText('fields.username')).toHaveValue('reader');
      expect(screen.queryByLabelText('fields.email')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('fields.password')).not.toBeInTheDocument();
      expect(authService.getAccessToken()).toBeNull();
      expect(post).not.toHaveBeenCalled();
    }
  );

  it('requires a username before starting the Passkey ceremony', async () => {
    renderLogin();
    fireEvent.click(await screen.findByRole('button', { name: 'entry.continueWithPasskey' }));
    fireEvent.click(screen.getByRole('button', { name: 'entry.continue' }));
    expect(toast.error).toHaveBeenCalledWith('usernameRequired');
    expect(continueWithPasskey).not.toHaveBeenCalled();
  });

  it('lets existing long usernames reach account lookup instead of enforcing new-signup limits', async () => {
    const username = 'legacy_oauth_user_with_a_long_username';
    renderLogin();
    fireEvent.click(await screen.findByRole('button', { name: 'entry.continueWithPasskey' }));
    fireEvent.change(screen.getByLabelText('fields.username'), { target: { value: username } });
    fireEvent.click(screen.getByRole('button', { name: 'entry.continue' }));
    await waitFor(() => expect(continueWithPasskey).toHaveBeenCalledWith({ username }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/explore'));
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
    expect(continueWithPasskey).not.toHaveBeenCalled();
  });

  it('keeps the combined Passkey entry for existing users when registration is closed', async () => {
    state.allowRegistration = false;
    renderLogin();
    expect(await screen.findByRole('button', { name: 'entry.continueWithPasskey' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'entry.continueWithPasskey' }));
    fireEvent.change(screen.getByLabelText('fields.username'), { target: { value: 'reader' } });
    fireEvent.click(screen.getByRole('button', { name: 'entry.continue' }));
    await waitFor(() => expect(continueWithPasskey).toHaveBeenCalledWith({ username: 'reader' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/explore'));
  });

  it('hides traditional account registration while retaining old-user login when registration is closed', async () => {
    state.allowRegistration = false;
    renderLogin();
    await screen.findByRole('button', { name: 'entry.continueWithPasskey' });
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
      screen.queryByRole('button', { name: 'entry.continueWithPasskey' })
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
      screen.queryByRole('button', { name: 'entry.continueWithPasskey' })
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
      await screen.findAllByRole('button', { name: 'entry.continueWithProvider' })
    ).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: 'entry.continueWithPasskey' })
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
});
