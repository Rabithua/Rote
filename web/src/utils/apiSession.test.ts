import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from './auth';

type Config = { headers: Record<string, string>; baseURL?: string };
const mocks = vi.hoisted(() => {
  const state: { request?: (config: Config) => Promise<Config> } = {};
  const post = vi.fn();
  return {
    state,
    post,
    api: {
      interceptors: {
        request: {
          use: vi.fn((callback) => {
            state.request = callback;
          }),
        },
        response: { use: vi.fn() },
      },
    },
  };
});
vi.mock('axios', () => ({ default: { create: () => mocks.api, post: mocks.post } }));
const { refreshAccessToken, AuthSessionChangedError } = await import('./api');

function tokens(owner: string) {
  const jwt = (kind: string, expiration: number) =>
    `header.${btoa(JSON.stringify({ userId: owner, exp: expiration, kind }))}.signature`;
  return {
    access: jwt('access', Math.floor(Date.now() / 1000) - 60),
    refresh: jwt('refresh', Math.floor(Date.now() / 1000) + 3600),
  };
}
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function response(owner: string) {
  const exp = Math.floor(Date.now() / 1000) + 900;
  const accessToken = `header.${btoa(JSON.stringify({ userId: owner, exp, kind: 'new-access' }))}.signature`;
  return {
    data: { data: { accessToken, refreshToken: `${owner}-new-refresh` } },
  };
}

describe('token refresh account/site ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.__ROTE_CONFIG__ = { VITE_API_BASE: 'https://site-a.example.test' };
  });
  afterEach(() => {
    delete window.__ROTE_CONFIG__;
  });

  it('rejects a held old-account success before it can replace the new account tokens', async () => {
    const a = tokens('A');
    const b = tokens('B');
    authService.setTokens(a.access, a.refresh);
    const held = deferred();
    mocks.post.mockReturnValueOnce(held.promise);
    const saving = refreshAccessToken();
    const rejected = expect(saving).rejects.toBeInstanceOf(AuthSessionChangedError);
    authService.setTokens(b.access, b.refresh);
    held.resolve(response('A'));
    await rejected;
    expect(authService.getAccessToken()).toBe(b.access);
    expect(authService.getRefreshToken()).toBe(b.refresh);
  });

  it('does not clear a new account or its profile when an old refresh fails', async () => {
    const a = tokens('A');
    const b = tokens('B');
    authService.setTokens(a.access, a.refresh);
    const held = deferred();
    mocks.post.mockReturnValueOnce(held.promise);
    const saving = mocks.state.request!({ headers: {} });
    const rejected = expect(saving).rejects.toBeInstanceOf(AuthSessionChangedError);
    authService.setTokens(b.access, b.refresh);
    localStorage.setItem('profile', JSON.stringify({ id: 'B' }));
    held.reject(new Error('Old account refresh denied'));
    await rejected;
    expect(authService.getRefreshToken()).toBe(b.refresh);
    expect(JSON.parse(localStorage.getItem('profile')!)).toEqual({ id: 'B' });
  });

  it('does not commit a refresh after changing sites', async () => {
    const a = tokens('A');
    authService.setTokens(a.access, a.refresh);
    const held = deferred();
    mocks.post.mockReturnValueOnce(held.promise);
    const saving = refreshAccessToken();
    const rejected = expect(saving).rejects.toBeInstanceOf(AuthSessionChangedError);
    window.__ROTE_CONFIG__ = { VITE_API_BASE: 'https://site-b.example.test' };
    held.resolve(response('A'));
    await rejected;
    expect(authService.getAccessToken()).toBe(a.access);
  });

  it('rechecks the session before clearing it in the interceptor failure continuation', async () => {
    const a = tokens('A');
    const b = tokens('B');
    authService.setTokens(a.access, a.refresh);
    const held = deferred();
    mocks.post.mockReturnValueOnce(held.promise);
    const saving = mocks.state.request!({ headers: {} });
    const rejected = expect(saving).rejects.toThrow('refresh denied');
    // Runs after the refresh function's await reaction, before interceptor catch.
    void held.promise.catch(() => {
      authService.setTokens(b.access, b.refresh);
      localStorage.setItem('profile', JSON.stringify({ id: 'B' }));
    });
    held.reject(new Error('refresh denied'));
    await rejected;
    expect(authService.getRefreshToken()).toBe(b.refresh);
    expect(JSON.parse(localStorage.getItem('profile')!)).toEqual({ id: 'B' });
  });

  it('rejects an old successful refresh before attaching its token after a login change', async () => {
    const a = tokens('A');
    const b = tokens('B');
    authService.setTokens(a.access, a.refresh);
    const held = deferred();
    mocks.post.mockReturnValueOnce(held.promise);
    const saving = mocks.state.request!({ headers: {} });
    const rejected = expect(saving).rejects.toBeInstanceOf(AuthSessionChangedError);
    void held.promise.then(() => authService.setTokens(b.access, b.refresh));
    held.resolve(response('A'));
    await rejected;
    expect(authService.getAccessToken()).toBe(b.access);
  });

  it('rejects a refresh from before logout even when the same tokens are restored', async () => {
    const a = tokens('A');
    authService.setTokens(a.access, a.refresh);
    const held = deferred();
    mocks.post.mockReturnValueOnce(held.promise);
    const saving = refreshAccessToken();
    const rejected = expect(saving).rejects.toBeInstanceOf(AuthSessionChangedError);
    authService.clearTokens();
    authService.setTokens(a.access, a.refresh);
    held.resolve(response('A'));
    await rejected;
    expect(authService.getAccessToken()).toBe(a.access);
  });

  it('keeps single-flight refreshes separate across account changes', async () => {
    const a = tokens('A');
    const b = tokens('B');
    const oldRefresh = deferred();
    const newRefresh = deferred();
    mocks.post.mockReturnValueOnce(oldRefresh.promise).mockReturnValueOnce(newRefresh.promise);
    authService.setTokens(a.access, a.refresh);
    const oldRequest = mocks.state.request!({ headers: {} });
    const rejected = expect(oldRequest).rejects.toBeInstanceOf(AuthSessionChangedError);
    authService.setTokens(b.access, b.refresh);
    const newRequest = mocks.state.request!({ headers: {} });
    expect(mocks.post).toHaveBeenCalledTimes(2);
    oldRefresh.resolve(response('A'));
    await rejected;
    const accepted = response('B');
    newRefresh.resolve(accepted);
    expect((await newRequest).headers.Authorization).toBe(
      `Bearer ${accepted.data.data.accessToken}`
    );
    expect(authService.getAccessToken()).toBe(accepted.data.data.accessToken);
  });
});
