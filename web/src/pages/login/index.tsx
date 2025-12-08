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
import { get, getApiUrl, post } from '@/utils/api';
import { authService } from '@/utils/auth';
import { useAPIGet } from '@/utils/fetcher';
import { Github } from 'lucide-react';
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

  const { data: backendStatusOk, isLoading: isCheckingStatus } = useAPIGet<{
    isInitialized: boolean;
    ui?: {
      allowRegistration?: boolean;
      allowUploadFile?: boolean;
    };
    oauth?: {
      enabled?: boolean;
      providers?: {
        github?: {
          enabled?: boolean;
        };
        apple?: {
          enabled?: boolean;
        };
      };
    };
  }>('checkStatus', () => get('/site/status').then((res) => res.data));

  const { data: profile, mutate: mutateProfile } = useAPIGet(
    authService.hasValidAccessToken() ? '/users/me/profile' : null,
    () => get('/users/me/profile').then((res) => res.data)
  );

  const navigate = useNavigate();

  const [disbled, setDisbled] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [searchParams] = useSearchParams();

  // 如果注册被禁用，确保 activeTab 是 'login'
  useEffect(() => {
    if (
      backendStatusOk &&
      backendStatusOk.ui?.allowRegistration === false &&
      activeTab === 'register'
    ) {
      setActiveTab('login');
    }
  }, [backendStatusOk, activeTab]);

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
    password: z
      .string()
      .refine((val) => val.length > 0, { message: t('passwordRequired') })
      .refine((val) => val.length >= 6, { message: t('passwordMin') })
      .max(128, t('passwordMaxLength')),
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
    password: z
      .string()
      .refine((val) => val.length > 0, { message: t('passwordRequired') })
      .refine((val) => val.length >= 6, { message: t('passwordMin') })
      .max(128, t('passwordMaxLength')),
    email: z
      .string()
      .min(1, t('emailRequired'))
      .max(30, t('emailMaxLength'))
      .email(t('emailFormat')),
    nickname: z.string().min(1, t('nicknameRequired')).max(20, t('nicknameMaxLength')),
  });

  // 提取 Zod 验证错误消息的辅助函数
  function getZodErrorMessage(err: any): string {
    // 优先从 issues 数组提取（标准 Zod 错误格式）
    if (Array.isArray(err.issues) && err.issues.length > 0) {
      const firstIssue = err.issues[0];
      if (firstIssue?.message && typeof firstIssue.message === 'string') {
        return firstIssue.message;
      }
    }

    // 降级：尝试从 message 中解析 JSON（兼容某些场景）
    if (err.message && typeof err.message === 'string') {
      try {
        const parsed = JSON.parse(err.message);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.message) {
          return parsed[0].message;
        }
      } catch {
        // 解析失败，继续尝试其他方式
      }

      // 如果 message 本身就是一个字符串，直接返回
      if (err.message.length > 0) {
        return err.message;
      }
    }

    // 最后的降级方案
    return t('passwordRequired') || 'Validation failed';
  }

  function authorizeIosLogin() {
    const accessToken = authService.getAccessToken();
    const refreshToken = authService.getRefreshToken();
    if (accessToken && refreshToken) {
      const callbackUrl = `rote://callback?token=${accessToken}&refreshToken=${refreshToken}`;
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
      toast.error(getZodErrorMessage(err));
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
          const callbackUrl = `rote://callback?token=${accessToken}&refreshToken=${refreshToken}`;
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
      toast.error(getZodErrorMessage(err));
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

  // 处理 OAuth 回调
  useEffect(() => {
    const oauthStatus = searchParams.get('oauth');
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');
    const errorMessage = searchParams.get('message');

    if (oauthStatus === 'success' && token && refreshToken) {
      // OAuth 登录成功
      authService.setTokens(token, refreshToken);
      const provider = searchParams.get('provider');
      if (provider === 'apple') {
        toast.success(t('messages.appleLoginSuccess'));
      } else {
        toast.success(t('messages.oauthLoginSuccess'));
      }
      mutateProfile();

      // 检查是否为 iOS web 登录流程
      if (searchParams.get('type') === 'ioslogin') {
        const callbackUrl = `rote://callback?token=${token}&refreshToken=${refreshToken}`;
        window.location.href = callbackUrl;
        return;
      }

      // 清除 URL 参数并重定向
      navigate('/home', { replace: true });
    } else if (oauthStatus === 'error' && errorMessage) {
      // OAuth 登录失败
      toast.error(decodeURIComponent(errorMessage));
      // 清除 URL 参数
      navigate('/login', { replace: true });
    } else if (oauthStatus === 'cancelled') {
      // 用户取消授权（可能是 GitHub 或 Apple）
      const provider = searchParams.get('provider');
      if (provider === 'apple') {
        toast.info(t('messages.appleCancelled'));
      } else {
        toast.info(t('messages.oauthCancelled'));
      }
      // 清除 URL 参数
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate, mutateProfile, t]);

  // GitHub OAuth 登录
  function handleGitHubLogin() {
    const iosLogin = searchParams.get('type') === 'ioslogin';
    const redirectUrl = iosLogin ? '/login?type=ioslogin' : '/login';
    // 使用完整的 API URL
    const oauthUrl = `${getApiUrl()}/auth/oauth/github?type=${iosLogin ? 'ioslogin' : 'web'}&redirect=${encodeURIComponent(redirectUrl)}`;
    window.location.href = oauthUrl;
  }

  // Apple OAuth 登录
  function handleAppleLogin() {
    const iosLogin = searchParams.get('type') === 'ioslogin';
    const redirectUrl = iosLogin ? '/login?type=ioslogin' : '/login';
    // 使用完整的 API URL
    const oauthUrl = `${getApiUrl()}/auth/oauth/apple?type=${iosLogin ? 'ioslogin' : 'web'}&redirect=${encodeURIComponent(redirectUrl)}`;
    window.location.href = oauthUrl;
  }

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
                <TabsList
                  className={`grid w-full ${backendStatusOk.ui?.allowRegistration !== false ? 'grid-cols-2' : 'grid-cols-1'}`}
                >
                  <TabsTrigger value="login">{t('buttons.login')}</TabsTrigger>
                  {backendStatusOk.ui?.allowRegistration !== false && (
                    <TabsTrigger value="register">{t('buttons.register')}</TabsTrigger>
                  )}
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
                      {backendStatusOk?.oauth?.enabled &&
                        (backendStatusOk?.oauth?.providers?.github?.enabled ||
                          backendStatusOk?.oauth?.providers?.apple?.enabled) && (
                          <>
                            <div className="relative my-4">
                              <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                              </div>
                              <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background text-muted-foreground px-2">
                                  {t('oauth.or')}
                                </span>
                              </div>
                            </div>
                            {backendStatusOk?.oauth?.providers?.github?.enabled && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleGitHubLogin}
                                className="w-full"
                                disabled={disbled}
                              >
                                <Github className="mr-2 size-4" />
                                {t('buttons.loginWithGitHub')}
                              </Button>
                            )}
                            {backendStatusOk?.oauth?.providers?.apple?.enabled && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleAppleLogin}
                                className="w-full"
                                disabled={disbled}
                              >
                                <span className="mr-2 text-lg">🍎</span>
                                {t('buttons.loginWithApple')}
                              </Button>
                            )}
                          </>
                        )}
                    </TabsContent>

                    {backendStatusOk.ui?.allowRegistration !== false && (
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
                    )}

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
