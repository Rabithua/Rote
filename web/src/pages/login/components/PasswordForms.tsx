import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { LoginData, RegisterData } from '../types';

type PasswordLoginFormProps = {
  allowRegistration: boolean;
  disabled: boolean;
  loginData: LoginData;
  onLogin: () => void;
  onFieldChange: (key: keyof LoginData, value: string) => void;
  onRegister: () => void;
  onBack?: () => void;
};

export function PasswordLoginForm({
  allowRegistration,
  disabled,
  loginData,
  onLogin,
  onFieldChange,
  onRegister,
  onBack,
}: PasswordLoginFormProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.login' });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!disabled) onLogin();
  }

  return (
    <form className="space-y-5" onSubmit={submit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="login-username">{t('fields.usernameOrEmail')}</Label>
        <Input
          id="login-username"
          autoComplete="username"
          maxLength={255}
          value={loginData.username}
          onChange={(event) => onFieldChange('username', event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">{t('fields.password')}</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          value={loginData.password}
          onChange={(event) => onFieldChange('password', event.target.value)}
        />
      </div>
      <div className="flex gap-3">
        {onBack && (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={disabled}
            onClick={onBack}
          >
            {t('entry.back')}
          </Button>
        )}
        <Button type="submit" className="flex-[2]" disabled={disabled}>
          {disabled ? t('messages.loggingIn') : t('buttons.login')}
        </Button>
      </div>
      {allowRegistration && (
        <Button
          type="button"
          variant="link"
          className="text-muted-foreground w-full"
          disabled={disabled}
          onClick={onRegister}
        >
          {t('entry.registerWithEmail')}
        </Button>
      )}
    </form>
  );
}

type PasswordRegisterFormProps = {
  disabled: boolean;
  registerData: RegisterData;
  onRegister: () => void;
  onFieldChange: (key: keyof RegisterData, value: string) => void;
  onBack: () => void;
};

export function PasswordRegisterForm({
  disabled,
  registerData,
  onRegister,
  onFieldChange,
  onBack,
}: PasswordRegisterFormProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.login' });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!disabled) onRegister();
  }

  return (
    <form className="space-y-5" onSubmit={submit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="register-username">{t('fields.username')}</Label>
        <Input
          id="register-username"
          autoComplete="username"
          maxLength={20}
          value={registerData.username}
          onChange={(event) => onFieldChange('username', event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-email">{t('fields.email')}</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          maxLength={255}
          value={registerData.email}
          onChange={(event) => onFieldChange('email', event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-password">{t('fields.password')}</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          maxLength={128}
          value={registerData.password}
          onChange={(event) => onFieldChange('password', event.target.value)}
        />
      </div>
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={disabled}
          onClick={onBack}
        >
          {t('entry.back')}
        </Button>
        <Button type="submit" className="flex-[2]" disabled={disabled}>
          {disabled ? t('messages.registering') : t('buttons.register')}
        </Button>
      </div>
    </form>
  );
}
