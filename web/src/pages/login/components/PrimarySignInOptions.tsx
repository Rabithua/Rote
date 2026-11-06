import { AppleIcon } from '@/components/icons/Apple';
import { Button } from '@/components/ui/button';
import { ChevronRight, Fingerprint, Github } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OAuthProviders } from '../types';

type PrimarySignInOptionsProps = {
  disabled: boolean;
  oauthProviders?: OAuthProviders;
  passkeyEnabled: boolean;
  onOAuthLogin: (provider: string) => void;
  onPasskeyContinue: () => void;
  onOtherWays: () => void;
};

export function PrimarySignInOptions({
  disabled,
  oauthProviders,
  passkeyEnabled,
  onOAuthLogin,
  onPasskeyContinue,
  onOtherWays,
}: PrimarySignInOptionsProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.login' });

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {passkeyEnabled && (
          <Button className="w-full" disabled={disabled} onClick={onPasskeyContinue}>
            <Fingerprint className="size-4" aria-hidden="true" />
            {t('entry.continueWithPasskey')}
          </Button>
        )}
        {Object.entries(oauthProviders ?? {}).map(([provider, config]) =>
          config?.enabled ? (
            <Button
              key={provider}
              variant="outline"
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
          ) : null
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
