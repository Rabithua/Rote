import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from '../auth';

type RequestConfig = {
  baseURL?: string;
  headers: Record<string, string>;
  skipAuthentication?: boolean;
};

type RequestInterceptor = (config: RequestConfig) => Promise<RequestConfig>;

const axiosMocks = vi.hoisted(() => {
  const state: { requestInterceptor?: RequestInterceptor } = {};
  const mockPost = vi.fn();
  const mockApi = {
    interceptors: {
      request: {
        use: vi.fn((interceptor: RequestInterceptor) => {
          state.requestInterceptor = interceptor;
        }),
      },
      response: {
        use: vi.fn(),
      },
    },
    request: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };

  return {
    state,
    mockPost,
    mockApi,
  };
});

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => axiosMocks.mockApi),
    post: axiosMocks.mockPost,
  },
}));

await import('../api');

function createToken(expiresAt: number): string {
  return `header.${btoa(JSON.stringify({ exp: expiresAt }))}.signature`;
}

describe('API authentication request interceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('refreshes an expired access token before sending an optional-auth request', async () => {
    const expiredAccessToken = createToken(Math.floor(Date.now() / 1000) - 60);
    const validRefreshToken = createToken(Math.floor(Date.now() / 1000) + 3600);
    const newAccessToken = createToken(Math.floor(Date.now() / 1000) + 900);
    const newRefreshToken = createToken(Math.floor(Date.now() / 1000) + 7200);

    authService.setTokens(expiredAccessToken, validRefreshToken);
    axiosMocks.mockPost.mockResolvedValue({
      data: {
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      },
    });

    const config = await axiosMocks.state.requestInterceptor?.({ headers: {} });

    expect(axiosMocks.mockPost).toHaveBeenCalledTimes(1);
    expect(config?.headers.Authorization).toBe(`Bearer ${newAccessToken}`);
    expect(authService.getAccessToken()).toBe(newAccessToken);
  });

  it('shares one token refresh across concurrent requests', async () => {
    const expiredAccessToken = createToken(Math.floor(Date.now() / 1000) - 60);
    const validRefreshToken = createToken(Math.floor(Date.now() / 1000) + 3600);
    const newAccessToken = createToken(Math.floor(Date.now() / 1000) + 900);
    const newRefreshToken = createToken(Math.floor(Date.now() / 1000) + 7200);

    authService.setTokens(expiredAccessToken, validRefreshToken);
    axiosMocks.mockPost.mockResolvedValue({
      data: {
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      },
    });

    const configs = await Promise.all([
      axiosMocks.state.requestInterceptor?.({ headers: {} }),
      axiosMocks.state.requestInterceptor?.({ headers: {} }),
    ]);

    expect(axiosMocks.mockPost).toHaveBeenCalledTimes(1);
    expect(
      configs.every((config) => config?.headers.Authorization === `Bearer ${newAccessToken}`)
    ).toBe(true);
  });

  it('does not refresh or attach tokens for public initialization requests', async () => {
    const expiredAccessToken = createToken(Math.floor(Date.now() / 1000) - 60);
    const validRefreshToken = createToken(Math.floor(Date.now() / 1000) + 3600);

    authService.setTokens(expiredAccessToken, validRefreshToken);

    const config = await axiosMocks.state.requestInterceptor?.({
      headers: {},
      skipAuthentication: true,
    });

    expect(axiosMocks.mockPost).not.toHaveBeenCalled();
    expect(config?.headers.Authorization).toBeUndefined();
  });
});
