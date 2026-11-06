import { Button } from '@/components/ui/button';
import { Fingerprint } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AuthView, LoginData, OAuthProviders, RegisterData } from '../types';
import { AuthMethodDivider } from './AuthMethodDivider';
import { AuthTabs } from './AuthTabs';
import { PrimarySignInOptions } from './PrimarySignInOptions';

type StandardLoginPanelProps = {
  activeTab: AuthView;
  allowRegistration: boolean;
  disabled: boolean;
  loginData: LoginData;
  oauthProviders?: OAuthProviders;
  passkeyEnabled: boolean;
  registerData: RegisterData;
  onActiveTabChange: (value: AuthView) => void;
  onLogin: () => void;
  onLoginFieldChange: (key: keyof LoginData, value: string) => void;
  onOAuthLogin: (provider: string) => void;
  onRegister: () => void;
  onPasskeyLogin: () => void;
  onRegisterFieldChange: (key: keyof RegisterData, value: string) => void;
};

export function StandardLoginPanel(props: StandardLoginPanelProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.login' });
  const { allowRegistration, disabled, passkeyEnabled, oauthProviders, onActiveTabChange } = props;
  const hasOAuth = Object.values(oauthProviders ?? {}).some((provider) => provider?.enabled);
  const requestedView =
    !allowRegistration && props.activeTab === 'password-register' ? 'primary' : props.activeTab;
  const view = !hasOAuth && requestedView === 'primary' ? 'password-login' : requestedView;

  return view === 'primary' ? (
    <PrimarySignInOptions
      disabled={disabled}
      oauthProviders={oauthProviders}
      passkeyEnabled={passkeyEnabled}
      onOAuthLogin={props.onOAuthLogin}
      onPasskeyLogin={props.onPasskeyLogin}
      onOtherWays={() => onActiveTabChange('password-login')}
    />
  ) : (
    <>
      <AuthTabs
        activeTab={view === 'password-register' ? 'register' : 'login'}
        allowRegistration={allowRegistration}
        disabled={disabled}
        loginData={props.loginData}
        registerData={props.registerData}
        onActiveTabChange={(tab) =>
          onActiveTabChange(tab === 'register' ? 'password-register' : 'password-login')
        }
        onLogin={props.onLogin}
        onLoginFieldChange={props.onLoginFieldChange}
        onRegister={props.onRegister}
        onRegisterFieldChange={props.onRegisterFieldChange}
      />
      {!hasOAuth && passkeyEnabled && (
        <div className="mt-4 space-y-3">
          <AuthMethodDivider />
          <Button
            variant="outline"
            className="w-full"
            disabled={disabled}
            onClick={props.onPasskeyLogin}
          >
            <Fingerprint className="size-4" aria-hidden="true" />
            {t('passkey.loginWithPasskey')}
          </Button>
        </div>
      )}
      {hasOAuth && (
        <Button
          variant="ghost"
          className="text-muted-foreground mt-4 w-full"
          disabled={disabled}
          onClick={() => onActiveTabChange('primary')}
        >
          {t('entry.back')}
        </Button>
      )}
    </>
  );
}
