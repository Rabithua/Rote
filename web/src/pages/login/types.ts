export type LoginData = {
  username: string;
  password: string;
};

export type RegisterData = {
  username: string;
  password: string;
  email: string;
  nickname: string;
};

export type AuthView = 'primary' | 'password-login' | 'password-register' | 'passkey-continue';

export type OAuthProviders = Record<string, { enabled?: boolean }>;

export type LoginProfile = {
  username?: string | null;
  nickname?: string | null;
};

export type AuthenticationTokens = {
  accessToken: string;
  refreshToken: string;
};
