import { getApiUrl } from '@/utils/api';
import type { SystemConfig } from '../types';

type OAuthConfig = NonNullable<NonNullable<SystemConfig['security']>['oauth']>;

export function normalizeOAuthConfig(
  oauth: NonNullable<SystemConfig['security']>['oauth']
): OAuthConfig {
  const providers = oauth?.providers || {};
  return {
    ...oauth,
    enabled: oauth?.enabled ?? false,
    providers: {
      ...providers,
      github: providers.github || {
        enabled: false,
        clientId: '',
        clientSecret: '',
        callbackUrl: `${getApiUrl()}/auth/oauth/github/callback`,
        scopes: ['user:email'],
      },
      apple: providers.apple || {
        enabled: false,
        clientId: '',
        teamId: '',
        keyId: '',
        privateKey: '',
        callbackUrl: `${getApiUrl()}/auth/oauth/apple/callback`,
        scopes: ['name', 'email'],
      },
    },
  };
}
