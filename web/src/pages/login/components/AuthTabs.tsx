import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from '@/components/animate-ui/radix/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { LoginData, RegisterData } from '../types';

type AuthTabsProps = {
  activeTab: string;
  allowRegistration: boolean;
  disabled: boolean;
  loginData: LoginData;
  registerData: RegisterData;
  onActiveTabChange: (value: string) => void;
  onLogin: () => void;
  onLoginFieldChange: (key: keyof LoginData, value: string) => void;
  onRegister: () => void;
  onRegisterFieldChange: (key: keyof RegisterData, value: string) => void;
};

export function AuthTabs({
  activeTab,
  allowRegistration,
  disabled,
  loginData,
  registerData,
  onActiveTabChange,
  onLogin,
  onLoginFieldChange,
  onRegister,
  onRegisterFieldChange,
}: AuthTabsProps) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.login',
  });

  function handleLoginKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      onLogin();
    }
  }

  function handleRegisterKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      onRegister();
    }
  }

  return (
    <Tabs value={activeTab} onValueChange={onActiveTabChange} className="w-full">
      <TabsList
        className={`grid w-full rounded-none border-b bg-transparent p-0 ${allowRegistration ? 'grid-cols-2' : 'grid-cols-1'}`}
        activeClassName="rounded-none bg-muted/60 shadow-none"
      >
        <TabsTrigger value="login">{t('buttons.login')}</TabsTrigger>
        {allowRegistration && <TabsTrigger value="register">{t('buttons.register')}</TabsTrigger>}
      </TabsList>

      <TabsContents>
        <div className="space-y-4">
          <TabsContent value="login" className="space-y-4 py-4">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="login-username">{t('fields.usernameOrEmail')}</Label>
                <Input
                  id="login-username"
                  placeholder={t('fields.usernameOrEmailPlaceholder')}
                  className="text-md rounded-md font-mono"
                  maxLength={255}
                  value={loginData.username}
                  onInput={(e) =>
                    onLoginFieldChange('username', (e.target as HTMLInputElement).value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">{t('fields.password')}</Label>
                <Input
                  id="login-password"
                  placeholder={t('fields.password')}
                  type="password"
                  className="text-md rounded-md font-mono"
                  maxLength={30}
                  value={loginData.password}
                  onInput={(e) =>
                    onLoginFieldChange('password', (e.target as HTMLInputElement).value)
                  }
                  onKeyDown={handleLoginKeyDown}
                />
              </div>
            </div>
            <Button disabled={disabled} onClick={onLogin} className="w-full">
              {disabled ? t('messages.loggingIn') : t('buttons.login')}
            </Button>
          </TabsContent>

          {allowRegistration && (
            <TabsContent value="register" className="space-y-4 py-4">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="register-username">{t('fields.username')}</Label>
                  <Input
                    id="register-username"
                    placeholder={t('fields.usernamePlaceholder')}
                    className="text-md rounded-md font-mono"
                    maxLength={20}
                    value={registerData.username}
                    onInput={(e) =>
                      onRegisterFieldChange('username', (e.target as HTMLInputElement).value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">{t('fields.email')}</Label>
                  <Input
                    id="register-email"
                    placeholder={t('fields.emailPlaceholder')}
                    className="text-md rounded-md font-mono"
                    maxLength={30}
                    value={registerData.email}
                    onInput={(e) =>
                      onRegisterFieldChange('email', (e.target as HTMLInputElement).value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-nickname">{t('fields.nickname')}</Label>
                  <Input
                    id="register-nickname"
                    placeholder={t('fields.nicknamePlaceholder')}
                    className="text-md rounded-md font-mono"
                    maxLength={20}
                    value={registerData.nickname}
                    onInput={(e) =>
                      onRegisterFieldChange('nickname', (e.target as HTMLInputElement).value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">{t('fields.password')}</Label>
                  <Input
                    id="register-password"
                    placeholder={t('fields.password')}
                    type="password"
                    className="text-md rounded-md font-mono"
                    maxLength={30}
                    value={registerData.password}
                    onInput={(e) =>
                      onRegisterFieldChange('password', (e.target as HTMLInputElement).value)
                    }
                    onKeyDown={handleRegisterKeyDown}
                  />
                </div>
              </div>
              <Button disabled={disabled} onClick={onRegister} className="w-full">
                {disabled ? t('messages.registering') : t('buttons.register')}
              </Button>
            </TabsContent>
          )}
        </div>
      </TabsContents>
    </Tabs>
  );
}
