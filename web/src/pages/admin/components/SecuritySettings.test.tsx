import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SystemConfig } from '../types';
import OAuthConfigTab from './OAuthConfigTab';
import SecurityConfigTab from './SecurityConfigTab';
import UIConfigTab from './UIConfigTab';

const { put, onMutate, translate } = vi.hoisted(() => ({
  put: vi.fn(),
  onMutate: vi.fn(),
  translate: vi.fn((key: string) => key),
}));

vi.mock('@/utils/api', () => ({ put, getApiUrl: () => 'https://rote.example/v2/api' }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: translate }) }));
vi.unmock('react-dom/client');

// Simulate an admin page loaded before the server stopped returning root keys.
const cachedSecurityConfig = {
  jwtSecret: 'cached-access-key',
  jwtRefreshSecret: 'cached-refresh-key',
  sessionSecret: 'cached-session-key',
  jwtAccessExpiry: '1h',
  jwtRefreshExpiry: '7d',
  requireVerifiedEmailForExplore: true,
  passkey: { enabled: true, rpId: 'rote.example' },
  oauth: {
    enabled: true,
    providers: {
      github: {
        enabled: true,
        clientId: 'github-client',
        clientSecret: 'github-secret',
        callbackUrl: 'https://rote.example/github/callback',
      },
      apple: {
        enabled: false,
        clientId: 'apple-client',
        teamId: 'team-id',
        keyId: 'key-id',
        privateKey: 'apple-private-key',
        callbackUrl: 'https://rote.example/apple/callback',
      },
    },
  },
};

function SettingsPage({ tab }: { tab: 'ui' | 'security' | 'oauth' }) {
  const [securityConfig, setSecurityConfig] =
    useState<SystemConfig['security']>(cachedSecurityConfig);
  const [uiConfig, setUiConfig] = useState<SystemConfig['ui']>({
    allowRegistration: true,
    defaultUserRole: 'user',
    apiRateLimit: 100,
  });
  const [isSaving, setIsSaving] = useState(false);
  const props = { securityConfig, setSecurityConfig, isSaving, setIsSaving, onMutate };

  if (tab === 'ui') {
    return <UIConfigTab {...props} uiConfig={uiConfig} setUiConfig={setUiConfig} />;
  }
  return tab === 'security' ? <SecurityConfigTab {...props} /> : <OAuthConfigTab {...props} />;
}

describe('admin security configuration ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    put.mockReset();
    put.mockResolvedValue({});
  });

  it.each(['ui', 'security'] as const)(
    '%s saves only its policy, even when the page cached root keys and unrelated settings',
    async (tab) => {
      render(<SettingsPage tab={tab} />);
      const policySwitch = screen.getAllByRole('switch')[tab === 'ui' ? 2 : 0];
      expect(policySwitch).toBeChecked();
      fireEvent.click(policySwitch);
      fireEvent.click(screen.getByRole('button', { name: 'save' }));

      await waitFor(() => expect(onMutate).toHaveBeenCalledOnce());
      expect(put).toHaveBeenCalledWith('/admin/settings', {
        group: 'security',
        config: { requireCertifiedUserForExplore: false },
      });
      expect(put).toHaveBeenCalledTimes(tab === 'ui' ? 2 : 1);
    }
  );

  it('saves the complete OAuth configuration and no fields owned by another settings page', async () => {
    render(<SettingsPage tab="oauth" />);
    fireEvent.change(screen.getByLabelText('oauth.github.clientId'), {
      target: { value: 'updated-github-client' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(onMutate).toHaveBeenCalledOnce());
    expect(put).toHaveBeenCalledExactlyOnceWith('/admin/settings', {
      group: 'security',
      config: {
        oauth: {
          ...cachedSecurityConfig.oauth,
          providers: {
            ...cachedSecurityConfig.oauth.providers,
            github: {
              ...cachedSecurityConfig.oauth.providers.github,
              clientId: 'updated-github-client',
            },
          },
        },
      },
    });
  });

  it('localizes a rejected cached-key save without reporting success', async () => {
    put.mockRejectedValueOnce({
      response: { data: { message: 'security_signing_keys_not_editable' } },
    });
    render(<SettingsPage tab="security" />);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(translate).toHaveBeenCalledWith('security.errors.security_signing_keys_not_editable', {
        defaultValue: 'security_signing_keys_not_editable',
      })
    );
    expect(onMutate).not.toHaveBeenCalled();
  });
});
