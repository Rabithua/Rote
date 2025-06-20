import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from '@/components/animate-ui/radix/tabs';
import { TypingText } from '@/components/animate-ui/text/typing';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import Logo from '@/components/others/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import mainJson from '@/json/main.json';
import type { Profile } from '@/types/main';
import { get, post } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
const { safeRoutes } = mainJson;

function Login() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.login',
  });

  const { data: backendStatusOk, isLoading: isCheckingStatus } = useAPIGet('checkStatus', () =>
    get('/site/status').then((res) => res.data)
  );

  const { data: profile, mutate } = useAPIGet<Profile>('profile', () =>
    get('/users/me/profile').then((res) => res.data)
  );

  const navigate = useNavigate();

  const [disbled, setDisbled] = useState(false);

  const [loginData, setLoginData] = useState({
    username: '',
    password: '',
  });

  const [registerData, setRegisterData] = useState({
    username: '',
    password: '',
    email: '',
    nickname: '',
  });

  const LoginDataZod = z.object({
    username: z.string().min(1, t('usernameRequired')).max(20, t('usernameMaxLength')),
    password: z.string().min(1, t('passwordRequired')).max(30, t('passwordMaxLength')),
  });

  const RegisterDataZod = z.object({
    username: z
      .string()
      .min(1, t('usernameRequired'))
      .max(20, t('usernameMaxLength'))
      .regex(/^[A-Za-z0-9_-]+$/, t('usernameFormat'))
      .refine((value) => !safeRoutes.includes(value), {
        message: t('usernameConflict'),
      }),
    password: z.string().min(1, t('passwordRequired')).max(30, t('passwordMaxLength')),
    email: z
      .string()
      .min(1, t('emailRequired'))
      .max(30, t('emailMaxLength'))
      .email(t('emailFormat')),
    nickname: z.string().min(1, t('nicknameRequired')).max(20, t('nicknameMaxLength')),
  });

  function login() {
    try {
      LoginDataZod.parse(loginData);
    } catch (err: any) {
      toast.error(JSON.parse(err.message)[0].message);
      return;
    }

    setDisbled(true);
    post('/auth/login', loginData)
      .then(() => {
        toast.success(t('messages.loginSuccess'));
        setDisbled(false);
        mutate();
        navigate('/home');
      })
      .catch((err: any) => {
        setDisbled(false);
        if ('code' in (err.response?.data || {})) {
          toast.error(err.response?.data?.msg || t('messages.backendDown'));
        } else {
          toast.error(t('messages.backendDown'));
        }
      });
  }

  function register() {
    try {
      RegisterDataZod.parse(registerData);
    } catch (err: any) {
      toast.error(JSON.parse(err.message)[0].message);
      return;
    }

    setDisbled(true);
    post('/auth/register', registerData)
      .then(() => {
        toast.success(t('messages.registerSuccess'));
        setDisbled(false);
        setRegisterData({
          username: '',
          password: '',
          email: '',
          nickname: '',
        });
        // 注册成功后可以考虑自动切换到登录 tab 或者直接登录
      })
      .catch((err: any) => {
        setDisbled(false);
        toast.error(err.response?.data?.msg || t('messages.backendDown'));
      });
  }

  function handleInputChange(e: any, key: string, formType: 'login' | 'register') {
    if (formType === 'login') {
      const { value } = e.target;
      setLoginData((prevState) => ({
        ...prevState,
        [key]: value,
      }));
    } else {
      const { value } = e.target;
      setRegisterData((prevState) => ({
        ...prevState,
        [key]: value,
      }));
    }
  }

  function handleLoginKeyDown(e: any) {
    if (e.key === 'Enter') {
      login();
    }
  }

  function handleRegisterKeyDown(e: any) {
    if (e.key === 'Enter') {
      register();
    }
  }

  useEffect(() => {
    if (profile) {
      navigate('/home');
    }
  }, [profile, navigate]);

  return (
    <div className="bg-pattern relative flex h-dvh w-full items-center justify-center">
      <div className="animate-show text-primary z-10 flex w-96 flex-col gap-2 rounded-lg px-2 py-6 pb-10 opacity-0">
        {isCheckingStatus ? (
          <LoadingPlaceholder className="py-8" size={6} />
        ) : (
          <>
            <div className="mb-4">
              <Logo className="w-32" color="#07C160" />
            </div>

            {backendStatusOk ? (
              <Tabs defaultValue="login" className="bg-muted w-full rounded-lg">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">{t('buttons.login')}</TabsTrigger>
                  <TabsTrigger value="register">{t('buttons.register')}</TabsTrigger>
                </TabsList>

                <TabsContents className="bg-background mx-1 -mt-2 mb-1 h-full rounded-sm">
                  <div className="space-y-4 p-4">
                    <TabsContent value="login" className="space-y-4 py-4">
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="login-username">{t('fields.username')}</Label>
                          <Input
                            id="login-username"
                            placeholder="username"
                            className="text-md rounded-md font-mono"
                            maxLength={20}
                            value={loginData.username}
                            onInput={(e) => handleInputChange(e, 'username', 'login')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="login-password">{t('fields.password')}</Label>
                          <Input
                            id="login-password"
                            placeholder="password"
                            type="password"
                            className="text-md rounded-md font-mono"
                            maxLength={30}
                            value={loginData.password}
                            onInput={(e) => handleInputChange(e, 'password', 'login')}
                            onKeyDown={handleLoginKeyDown}
                          />
                        </div>
                      </div>
                      <Button disabled={disbled} onClick={login} className="w-full">
                        {disbled ? t('messages.loggingIn') : t('buttons.login')}
                      </Button>
                    </TabsContent>

                    <TabsContent value="register" className="space-y-4 py-4">
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="register-username">{t('fields.username')}</Label>
                          <Input
                            id="register-username"
                            placeholder="username"
                            className="text-md rounded-md font-mono"
                            maxLength={20}
                            value={registerData.username}
                            onInput={(e) => handleInputChange(e, 'username', 'register')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="register-email">{t('fields.email')}</Label>
                          <Input
                            id="register-email"
                            placeholder="someone@mail.com"
                            className="text-md rounded-md font-mono"
                            maxLength={30}
                            value={registerData.email}
                            onInput={(e) => handleInputChange(e, 'email', 'register')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="register-nickname">{t('fields.nickname')}</Label>
                          <Input
                            id="register-nickname"
                            placeholder="nickname"
                            className="text-md rounded-md font-mono"
                            maxLength={20}
                            value={registerData.nickname}
                            onInput={(e) => handleInputChange(e, 'nickname', 'register')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="register-password">{t('fields.password')}</Label>
                          <Input
                            id="register-password"
                            placeholder="password"
                            type="password"
                            className="text-md rounded-md font-mono"
                            maxLength={30}
                            value={registerData.password}
                            onInput={(e) => handleInputChange(e, 'password', 'register')}
                            onKeyDown={handleRegisterKeyDown}
                          />
                        </div>
                      </div>
                      <Button disabled={disbled} onClick={register} className="w-full">
                        {disbled ? t('messages.registering') : t('buttons.register')}
                      </Button>
                    </TabsContent>

                    <div className="my-4 flex cursor-pointer items-center justify-center gap-1 text-sm duration-300 active:scale-95">
                      <Link to="/explore">
                        <div className="duration-300 hover:opacity-60">{t('nav.explore')}</div>
                      </Link>
                      <span className="px-2">/</span>
                      <Link to="/landing">
                        <div className="duration-300 hover:opacity-60">{t('nav.home')}</div>
                      </Link>
                    </div>
                  </div>
                </TabsContents>
              </Tabs>
            ) : (
              <div>
                <div className=" ">{t('error.backendIssue')}</div>
                <div>{JSON.stringify(backendStatusOk)}</div>
                <TypingText className="text-sm opacity-60" text={t('error.dockerDeployment')} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Login;
