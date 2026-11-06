import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import type { AuthView, LoginData, OAuthProviders, RegisterData } from '../types';
import { AuthTabs } from './AuthTabs';
import { PrimarySignInOptions } from './PrimarySignInOptions';
import { UsernameRegistrationForm } from './UsernameRegistrationForm';

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
  onPasskeyContinue: () => void;
  onRegisterFieldChange: (key: keyof RegisterData, value: string) => void;
};

export function StandardLoginPanel(props: StandardLoginPanelProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.login' });
  const { allowRegistration, disabled, passkeyEnabled, oauthProviders, onActiveTabChange } = props;
  const hasModernSignIn =
    passkeyEnabled || Object.values(oauthProviders ?? {}).some((provider) => provider.enabled);
  const requestedView =
    (!allowRegistration && props.activeTab === 'password-register') ||
    (!passkeyEnabled && props.activeTab === 'passkey-continue')
      ? 'primary'
      : props.activeTab;
  const view = !hasModernSignIn && requestedView === 'primary' ? 'password-login' : requestedView;

  return view === 'primary' ? (
    <PrimarySignInOptions
      disabled={disabled}
      oauthProviders={oauthProviders}
      passkeyEnabled={passkeyEnabled}
      onOAuthLogin={props.onOAuthLogin}
      onPasskeyContinue={() => onActiveTabChange('passkey-continue')}
      onOtherWays={() => onActiveTabChange('password-login')}
    />
  ) : view === 'passkey-continue' ? (
    <UsernameRegistrationForm
      username={props.registerData.username}
      disabled={disabled}
      submitLabel={t('entry.continue')}
      busyLabel={t('messages.loggingIn')}
      maxLength={100}
      hint={t('entry.passkeyContinueHint')}
      onUsernameChange={(value) => props.onRegisterFieldChange('username', value)}
      onSubmit={props.onPasskeyContinue}
      onBack={() => onActiveTabChange('primary')}
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
      {hasModernSignIn && (
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
