import Logo from '@/components/others/logo';
import { useTranslation } from 'react-i18next';
import type { AuthView, LoginData, OAuthProviders, RegisterData } from '../types';
import { PasswordLoginForm, PasswordRegisterForm } from './PasswordForms';
import { PrimarySignInOptions } from './PrimarySignInOptions';
import { UsernameRegistrationForm } from './UsernameRegistrationForm';

type StandardLoginPanelProps = {
  activeTab: AuthView;
  allowRegistration: boolean;
  disabled: boolean;
  isAuthenticating: boolean;
  loginData: LoginData;
  oauthProviders?: OAuthProviders;
  passkeyEnabled: boolean;
  registerData: RegisterData;
  onActiveTabChange: (value: AuthView) => void;
  onLogin: () => void;
  onLoginFieldChange: (key: keyof LoginData, value: string) => void;
  onOAuthLogin: (provider: string) => void;
  onPasskeyLogin: () => Promise<void>;
  onRegister: () => void;
  onPasskeyRegister: () => void;
  onRegisterFieldChange: (key: keyof RegisterData, value: string) => void;
};

export function StandardLoginPanel(props: StandardLoginPanelProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.login' });
  const { allowRegistration, disabled, passkeyEnabled, oauthProviders, onActiveTabChange } = props;
  const hasModernSignIn =
    passkeyEnabled || Object.values(oauthProviders ?? {}).some((provider) => provider.enabled);
  const requestedView =
    (!allowRegistration &&
      (props.activeTab === 'passkey-register' || props.activeTab === 'password-register')) ||
    (!passkeyEnabled && props.activeTab === 'passkey-register')
      ? 'primary'
      : props.activeTab;
  const view = !hasModernSignIn && requestedView === 'primary' ? 'password-login' : requestedView;
  const titleKey =
    view === 'primary'
      ? 'entry.title'
      : view === 'passkey-register'
        ? 'entry.createTitle'
        : view === 'password-register'
          ? 'entry.emailRegisterTitle'
          : 'entry.emailLoginTitle';
  const descriptionKey =
    view === 'primary'
      ? 'entry.description'
      : view === 'passkey-register'
        ? 'entry.createDescription'
        : view === 'password-register'
          ? 'entry.emailRegisterDescription'
          : 'entry.emailLoginDescription';

  return (
    <>
      <Logo className="mb-5 w-28" color="#3ECF4A" />
      <div className="mb-6 space-y-2">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight text-balance">
          {t(titleKey)}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t(descriptionKey)}
        </p>
      </div>
      {view === 'primary' ? (
        <PrimarySignInOptions
          allowRegistration={allowRegistration}
          disabled={disabled}
          isAuthenticating={props.isAuthenticating}
          oauthProviders={oauthProviders}
          passkeyEnabled={passkeyEnabled}
          onOAuthLogin={props.onOAuthLogin}
          onPasskeyLogin={props.onPasskeyLogin}
          onCreateAccount={() => onActiveTabChange('passkey-register')}
          onOtherWays={() => onActiveTabChange('password-login')}
        />
      ) : view === 'passkey-register' ? (
        <UsernameRegistrationForm
          username={props.registerData.username}
          disabled={disabled}
          submitLabel={t('entry.createAccount')}
          onUsernameChange={(value) => props.onRegisterFieldChange('username', value)}
          onSubmit={props.onPasskeyRegister}
          onBack={() => onActiveTabChange('primary')}
        />
      ) : view === 'password-register' ? (
        <PasswordRegisterForm
          disabled={disabled}
          registerData={props.registerData}
          onRegister={props.onRegister}
          onFieldChange={props.onRegisterFieldChange}
          onBack={() => onActiveTabChange('password-login')}
        />
      ) : (
        <PasswordLoginForm
          allowRegistration={allowRegistration}
          disabled={disabled}
          loginData={props.loginData}
          onLogin={props.onLogin}
          onFieldChange={props.onLoginFieldChange}
          onRegister={() => onActiveTabChange('password-register')}
          onBack={hasModernSignIn ? () => onActiveTabChange('primary') : undefined}
        />
      )}
    </>
  );
}
