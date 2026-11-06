import { AppleIcon } from '@/components/icons/Apple';
import { Button } from '@/components/ui/button';
import { ChevronRight, Fingerprint, Github } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OAuthProviders } from '../types';
import { AuthMethodDivider } from './AuthMethodDivider';

type PrimarySignInOptionsProps = {
  disabled: boolean;
  oauthProviders?: OAuthProviders;
  passkeyEnabled: boolean;
  onOAuthLogin: (provider: string) => void;
  onPasskeyLogin: () => void;
  onOtherWays: () => void;
};

export function PrimarySignInOptions({
  disabled,
  oauthProviders,
  passkeyEnabled,
  onOAuthLogin,
  onPasskeyLogin,
  onOtherWays,
}: PrimarySignInOptionsProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.login' });
  const providers = Object.entries(oauthProviders ?? {})
    .filter(([, config]) => config?.enabled)
    .sort(([first], [second]) => Number(second === 'apple') - Number(first === 'apple'));

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {providers.map(([provider], index) => (
          <Button
            key={provider}
            variant={index === 0 ? 'default' : 'outline'}
            className="w-full"
            disabled={disabled}
            onClick={() => onOAuthLogin(provider)}
          >
            {provider === 'apple' ? (
              <AppleIcon className="size-4" aria-hidden="true" />
            ) : provider === 'github' ? (
              <Github className="size-4" aria-hidden="true" />
            ) : null}
            {t('entry.continueWithProvider', {
              provider:
                provider === 'github' ? 'GitHub' : provider === 'apple' ? 'Apple' : provider,
            })}
          </Button>
        ))}
        {passkeyEnabled && (
          <>
            {providers.length > 0 && <AuthMethodDivider />}
            <Button
              variant={providers.length ? 'outline' : 'default'}
              className="w-full"
              disabled={disabled}
              onClick={onPasskeyLogin}
            >
              <Fingerprint className="size-4" aria-hidden="true" />
              {t('passkey.loginWithPasskey')}
            </Button>
          </>
        )}
      </div>
      <Button
        variant="ghost"
        className="text-muted-foreground w-full"
        disabled={disabled}
        onClick={onOtherWays}
      >
        {t('entry.otherWays')}
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
