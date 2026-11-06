import { AppleIcon } from '@/components/icons/Apple';
import { Button } from '@/components/ui/button';
import { ChevronRight, Fingerprint, Github, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OAuthProviders } from '../types';

type PrimarySignInOptionsProps = {
  allowRegistration: boolean;
  disabled: boolean;
  isAuthenticating: boolean;
  oauthProviders?: OAuthProviders;
  passkeyEnabled: boolean;
  onOAuthLogin: (provider: string) => void;
  onPasskeyLogin: () => Promise<void>;
  onCreateAccount: () => void;
  onOtherWays: () => void;
};

export function PrimarySignInOptions({
  allowRegistration,
  disabled,
  isAuthenticating,
  oauthProviders,
  passkeyEnabled,
  onOAuthLogin,
  onPasskeyLogin,
  onCreateAccount,
  onOtherWays,
}: PrimarySignInOptionsProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.login' });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {passkeyEnabled && (
          <Button
            className="w-full"
            disabled={disabled || isAuthenticating}
            aria-busy={isAuthenticating}
            onClick={onPasskeyLogin}
          >
            {isAuthenticating ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Fingerprint className="size-4" aria-hidden="true" />
            )}
            {isAuthenticating ? t('messages.loggingIn') : t('passkey.loginWithPasskey')}
          </Button>
        )}
        {Object.entries(oauthProviders ?? {}).map(([provider, config]) => {
          if (!config?.enabled) return null;
          return (
            <Button
              key={provider}
              variant="outline"
              className="w-full"
              disabled={disabled || isAuthenticating}
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
          );
        })}
      </div>

      {allowRegistration && passkeyEnabled && (
        <div className="border-border space-y-2 border-t pt-5">
          <p className="text-muted-foreground text-center text-sm">{t('entry.newHere')}</p>
          <Button
            variant="secondary"
            className="w-full"
            disabled={disabled}
            onClick={onCreateAccount}
          >
            {t('entry.createWithPasskey')}
          </Button>
        </div>
      )}

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
