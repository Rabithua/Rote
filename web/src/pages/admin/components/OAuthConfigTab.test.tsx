import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SystemConfig } from '../types';
import OAuthConfigTab from './OAuthConfigTab';
import { normalizeOAuthConfig } from './oauthConfig';

vi.mock('@/utils/api', () => ({
  put: vi.fn(),
  getApiUrl: () => 'https://rote.example/v2/api',
}));
vi.unmock('react-dom/client');

describe('OAuth configuration defaults', () => {
  it('preserves existing and unknown providers while supplying missing supported providers', () => {
    const github = { enabled: true, clientId: 'existing-client', callbackUrl: 'custom-url' };
    const custom = { enabled: true, clientId: 'custom-client' };
    const original = { enabled: true, providers: { github, custom } };
    const normalized = normalizeOAuthConfig(original);

    expect(normalized.providers?.github).toBe(github);
    expect(normalized.providers?.custom).toBe(custom);
    expect(normalized.providers?.apple).toEqual({
      enabled: false,
      clientId: '',
      teamId: '',
      keyId: '',
      privateKey: '',
      callbackUrl: 'https://rote.example/v2/api/auth/oauth/apple/callback',
      scopes: ['name', 'email'],
    });
    expect(original.providers).not.toHaveProperty('apple');
  });

  it.each([undefined, {}, { oauth: { providers: {} } }] as SystemConfig['security'][])(
    'renders missing defaults without marking settings as edited (%j)',
    (securityConfig) => {
      const setSecurityConfig = vi.fn();
      render(
        <OAuthConfigTab
          securityConfig={securityConfig}
          setSecurityConfig={setSecurityConfig}
          isSaving={false}
          setIsSaving={vi.fn()}
          onMutate={vi.fn()}
        />
      );

      expect(screen.getAllByRole('switch')).toHaveLength(3);
      expect(setSecurityConfig).not.toHaveBeenCalled();
      fireEvent.click(screen.getAllByRole('switch')[0]);
      expect(setSecurityConfig).toHaveBeenCalledExactlyOnceWith({
        ...securityConfig,
        oauth: { ...normalizeOAuthConfig(securityConfig?.oauth), enabled: true },
      });
    }
  );
});
