import { StrictMode } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Action, ExternalToast } from 'sonner';
import { authService } from '@/utils/auth';
import { PasskeyAdoptionNotice } from './PasskeyAdoptionNotice';
import {
  markPasskeyAdoptionOffered,
  queuePasskeyAdoption,
  readPasskeyAdoptionIntent,
  shouldOfferPasskeyAdoption,
} from './intent';

const { state, listPasskeys, registerPasskey, notify } = vi.hoisted(() => ({
  state: { supported: true, enabled: true },
  listPasskeys: vi.fn(),
  registerPasskey: vi.fn(),
  notify: Object.assign(vi.fn(), {
    loading: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock('@/hooks/useSiteStatus', () => ({
  useSiteStatus: () => ({ data: { passkey: { enabled: state.enabled } } }),
}));
vi.mock('@/utils/passkey', () => ({
  isPasskeySupported: () => state.supported,
  listPasskeys,
  registerPasskey,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('sonner', () => ({ toast: notify }));

function tokenFor(accountId: string, signature = 'signature') {
  return `header.${btoa(JSON.stringify({ userId: accountId, username: accountId }))}.${signature}`;
}

function queueFor(accountId = 'reader') {
  const token = tokenFor(accountId);
  authService.setTokens(token, token);
  queuePasskeyAdoption(token, '/home', false);
}

function showNotice(accountId = 'reader') {
  return render(
    <StrictMode>
      <SWRConfig value={{ provider: () => new Map() }}>
        <PasskeyAdoptionNotice accountId={accountId} />
      </SWRConfig>
    </StrictMode>
  );
}

function offeredActions() {
  return notify.mock.calls[0][1] as ExternalToast & { action: Action; cancel: Action };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  state.supported = true;
  state.enabled = true;
  listPasskeys.mockResolvedValue([]);
  registerPasskey.mockResolvedValue(true);
  notify.loading.mockReturnValue('registering');
});

afterEach(cleanup);

describe('post-OAuth passkey adoption', () => {
  it('does not queue suggestions for iOS callbacks or MCP authorization', () => {
    const token = tokenFor('reader');
    queuePasskeyAdoption(token, '/home', true);
    expect(readPasskeyAdoptionIntent()).toBeNull();
    queuePasskeyAdoption(token, '/oauth/authorize?requestId=client-request', false);
    expect(readPasskeyAdoptionIntent()).toBeNull();
    queuePasskeyAdoption(token, '/home', false);
    expect(readPasskeyAdoptionIntent()?.accountId).toBe('reader');
  });

  it('offers once after navigation, and creates a passkey only when the action is selected', async () => {
    queueFor();
    showNotice();
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(registerPasskey).not.toHaveBeenCalled();
    expect(readPasskeyAdoptionIntent()).toBeNull();
    const action = offeredActions().action;
    expect(action).toMatchObject({ label: 'pages.passkeyAdoption.create' });
    await act(async () => {
      await action.onClick({} as never);
    });
    expect(registerPasskey).toHaveBeenCalledOnce();
    expect(notify.success).toHaveBeenCalledWith('pages.login.passkey.registerSuccess', {
      id: 'registering',
    });
  });

  it('allows deferring and does not repeat the offer on the next OAuth login', async () => {
    queueFor();
    const first = showNotice();
    await waitFor(() => expect(notify).toHaveBeenCalledOnce());
    const cancel = offeredActions().cancel;
    expect(cancel).toMatchObject({ label: 'pages.passkeyAdoption.later' });
    cancel.onClick({} as never);
    first.unmount();
    queueFor();
    showNotice();
    await waitFor(() => expect(readPasskeyAdoptionIntent()).toBeNull());
    expect(notify).toHaveBeenCalledOnce();
    expect(registerPasskey).not.toHaveBeenCalled();
  });

  it('does not suggest adding another passkey when the account already has one', async () => {
    listPasskeys.mockResolvedValue([{ id: 'existing-passkey' }]);
    queueFor();
    showNotice();
    await waitFor(() => expect(readPasskeyAdoptionIntent()).toBeNull());
    expect(notify).not.toHaveBeenCalled();
  });

  it.each(['unsupported', 'disabled'] as const)('skips the offer when %s', async (reason) => {
    state.supported = reason !== 'unsupported';
    state.enabled = reason !== 'disabled';
    queueFor();
    showNotice();
    await waitFor(() => expect(readPasskeyAdoptionIntent()).toBeNull());
    expect(listPasskeys).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not suggest for another account or register after the session changes', async () => {
    queueFor('first-account');
    const first = showNotice('second-account');
    expect(listPasskeys).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    first.unmount();
    queueFor();
    showNotice();
    await waitFor(() => expect(notify).toHaveBeenCalledOnce());
    authService.clearTokens();
    const action = offeredActions().action;
    await action.onClick({} as never);
    expect(registerPasskey).not.toHaveBeenCalled();
  });

  it('suppresses an optional suggestion if eligibility cannot be verified', async () => {
    listPasskeys.mockRejectedValue(new Error('unavailable'));
    queueFor();
    showNotice();
    await waitFor(() => expect(readPasskeyAdoptionIntent()).toBeNull());
    expect(notify).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
    expect(authService.getAccessToken()).toBe(tokenFor('reader'));
  });

  it.each(['success', 'abort'] as const)(
    'dismisses stale registration feedback after a cross-tab account change (%s)',
    async (outcome) => {
      let resolveRegistration!: () => void;
      let rejectRegistration!: (error: Error) => void;
      registerPasskey.mockReturnValue(
        new Promise<void>((resolve, reject) => {
          resolveRegistration = resolve;
          rejectRegistration = reject;
        })
      );
      queueFor();
      showNotice();
      await waitFor(() => expect(notify).toHaveBeenCalledOnce());
      let actionPromise: void | Promise<unknown>;
      act(() => {
        actionPromise = offeredActions().action.onClick({} as never);
      });
      localStorage.setItem('rote_access_token', tokenFor('another-reader'));
      await act(async () => {
        if (outcome === 'success') resolveRegistration();
        else rejectRegistration(new DOMException('Session changed', 'AbortError'));
        await actionPromise;
      });
      expect(notify.dismiss).toHaveBeenCalledWith('registering');
      expect(notify.success).not.toHaveBeenCalled();
      expect(notify.error).not.toHaveBeenCalled();
    }
  );

  it('keeps success feedback when the same account receives refreshed tokens', async () => {
    let resolveRegistration!: () => void;
    registerPasskey.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRegistration = resolve;
      })
    );
    queueFor();
    showNotice();
    await waitFor(() => expect(notify).toHaveBeenCalledOnce());
    let actionPromise: void | Promise<unknown>;
    act(() => {
      actionPromise = offeredActions().action.onClick({} as never);
    });
    const refreshedToken = tokenFor('reader', 'refreshed-signature');
    authService.setTokens(refreshedToken, refreshedToken);
    await act(async () => {
      resolveRegistration();
      await actionPromise;
    });
    expect(notify.success).toHaveBeenCalledWith('pages.login.passkey.registerSuccess', {
      id: 'registering',
    });
    expect(notify.dismiss).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('keeps the cooldown account-scoped and expires old navigation intents', () => {
    markPasskeyAdoptionOffered('reader');
    expect(shouldOfferPasskeyAdoption('reader')).toBe(false);
    expect(shouldOfferPasskeyAdoption('another-reader')).toBe(true);
    queueFor();
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(Date.now() + 11 * 60 * 1000);
    expect(readPasskeyAdoptionIntent()).toBeNull();
    now.mockRestore();
  });
});
