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
import { get, post } from '@/utils/api';
import { authService } from '@/utils/auth';
import { useAPIGet } from '@/utils/fetcher';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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

  const { data: profile, mutate: mutateProfile } = useAPIGet(
    authService.hasValidAccessToken() ? '/users/me/profile' : null,
    () => get('/users/me/profile').then((res) => res.data)
  );

  const navigate = useNavigate();

  const [disbled, setDisbled] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [searchParams] = useSearchParams();

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

  function authorizeIosLogin() {
    const accessToken = authService.getAccessToken();
    if (accessToken) {
      const callbackUrl = `rote://callback?token=${accessToken}`;
      window.location.href = callbackUrl;
    } else {
      // 如果 token 丢失，提示用户重新登录
      toast.error(t('messages.tokenNotFound'));
    }
  }

  function login() {
    try {
      LoginDataZod.parse(loginData);
    } catch (err: any) {
      toast.error(JSON.parse(err.message)[0].message);
      return;
    }

    setDisbled(true);
    post('/auth/login', loginData)
      .then((response) => {
        const { accessToken, refreshToken } = response.data;

        // 存储 tokens
        authService.setTokens(accessToken, refreshToken);

        toast.success(t('messages.loginSuccess'));
        setDisbled(false);
        // 登录成功后刷新全局 profile
        mutateProfile();

        // 检查是否为 iOS web 登录流程
        if (searchParams.get('type') === 'ioslogin') {
          const callbackUrl = `rote://callback?token=${accessToken}`;
          window.location.href = callbackUrl;
          return;
        }

        navigate('/home');
      })
      .catch((err: any) => {
        setDisbled(false);
        if ('code' in (err.response?.data || {})) {
          const errorMessage = err.response?.data?.message;
          toast.error(errorMessage || t('messages.backendDown'));
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
        // 注册成功后自动切换到登录 tab
        setActiveTab('login');
      })
      .catch((err: any) => {
        setDisbled(false);
        // 使用 message 字段
        const errorMessage = err.response?.data?.message;
        toast.error(errorMessage || t('messages.backendDown'));
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
    // 如果用户已有 token，则主动加载 profile
    // 这可以确保在用户已登录的情况下，直接访问登录页也能正确显示授权 UI
    if (authService.hasValidAccessToken()) {
      mutateProfile();
    }
  }, [mutateProfile]);

  return (
    <div className="relative flex h-dvh w-full items-center justify-center">
      <div className="animate-show text-primary z-10 flex w-96 flex-col gap-2 rounded-lg px-2 py-6 pb-10 opacity-0">
        {isCheckingStatus ? (
          <LoadingPlaceholder className="py-8" size={6} />
        ) : profile && searchParams.get('type') === 'ioslogin' ? (
          // 已登录且是 iOS 登录流程，显示授权UI
          <>
            <div className="mb-4">
              <Logo className="w-32" color="#07C160" />
            </div>
            <div className="bg-muted/50 w-full rounded-lg p-6">
              <h2 className="mb-4 text-lg"> {t('authorize.title')}</h2>
              <p className="mb-6 text-sm font-light">
                {t('authorize.message', {
                  username: profile.nickname || profile.username,
                })}
              </p>
              <Button onClick={authorizeIosLogin} className="w-full">
                {t('authorize.button')}
              </Button>
            </div>
          </>
        ) : (
          // 未登录或普通 web 访问，显示标准登录/注册UI
          <>
            <div className="mb-4">
              <Logo className="w-32" color="#07C160" />
            </div>

            {backendStatusOk ? (
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="bg-muted w-full rounded-lg"
              >
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
