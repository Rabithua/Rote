import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import { useSiteStatus } from '@/hooks/useSiteStatus';
import { usePasskey } from '@/hooks/usePasskey';
import { get, getApiUrl, post } from '@/utils/api';
import { authService } from '@/utils/auth';
import { useAPIGet } from '@/utils/fetcher';
import { getLoginPathWithRedirect, getSafeLoginRedirect } from '@/utils/loginRedirect';
import { registerWithPasskey } from '@/utils/passkey';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { IosAuthorizePanel } from './components/IosAuthorizePanel';
import { StandardLoginPanel } from './components/StandardLoginPanel';
import type { LoginData, RegisterData } from './types';
import { createLoginDataSchema, createRegisterDataSchema, getZodErrorMessage } from './validation';

function Login() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.login',
  });
  const { data: siteStatus } = useSiteStatus();

  const { data: backendStatusOk, isLoading: isCheckingStatus } = useAPIGet<{
    isInitialized: boolean;
    ui?: {
      allowRegistration?: boolean;
      allowUploadFile?: boolean;
    };
    oauth?: {
      enabled?: boolean;
      providers?: Record<string, { enabled?: boolean }>;
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
  const { authenticateWithPasskey, registerPasskey, isAuthenticating, isRegistering } =
    usePasskey();
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const isIosLoginFlow = searchParams.get('type') === 'ioslogin';
  const redirectTarget = searchParams.get('redirect');
  const postLoginRedirect = getSafeLoginRedirect(searchParams);

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

  const [loginData, setLoginData] = useState<LoginData>({
    username: '',
    password: '',
  });

  const [registerData, setRegisterData] = useState<RegisterData>({
    username: '',
    password: '',
    email: '',
    nickname: '',
  });

  // 检测域名并自动填充演示账号
  useEffect(() => {
    if (window.location.hostname === 'demo.rote.ink') {
      setLoginData({
        username: 'guang',
        password: 'password',
      });
    }
  }, []);

  const passkeyEnabled = siteStatus?.passkey?.enabled !== false;
  const LoginDataZod = createLoginDataSchema(t);
  const RegisterDataZod = createRegisterDataSchema({
    t,
    siteStatus,
    passkeyEnabled,
  });

  function getIosCallbackUrl(accessToken: string, refreshToken: string) {
    const params = new URLSearchParams({
      token: accessToken,
      refreshToken,
    });
    return `rote://callback?${params.toString()}`;
  }

  function redirectToIosLogin(accessToken: string, refreshToken: string) {
    window.location.href = getIosCallbackUrl(accessToken, refreshToken);
  }

  function completeAuthenticatedFlow(tokens?: {
    accessToken?: string | null;
    refreshToken?: string | null;
  }) {
    if (!isIosLoginFlow) {
      navigate(postLoginRedirect, { replace: true });
      return;
    }

    const accessToken = tokens?.accessToken ?? authService.getAccessToken();
    const refreshToken = tokens?.refreshToken ?? authService.getRefreshToken();
    if (accessToken && refreshToken) {
      redirectToIosLogin(accessToken, refreshToken);
    } else {
      toast.error(t('messages.tokenNotFound'));
    }
  }

  function authorizeIosLogin() {
    const accessToken = authService.getAccessToken();
    const refreshToken = authService.getRefreshToken();
    if (accessToken && refreshToken) {
      redirectToIosLogin(accessToken, refreshToken);
    } else {
      // 如果 token 丢失，提示用户重新登录
      toast.error(t('messages.tokenNotFound'));
    }
  }

  function login() {
    try {
      LoginDataZod.parse(loginData);
    } catch (err: any) {
      toast.error(getZodErrorMessage(err, t('passwordRequired')));
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
        completeAuthenticatedFlow({ accessToken, refreshToken });
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
      toast.error(getZodErrorMessage(err, t('passwordRequired')));
      return;
    }

    setDisbled(true);

    // No password + passkey enabled → two-step passkey registration
    if (!registerData.password && passkeyEnabled) {
      registerWithPasskey({
        username: registerData.username,
        email: registerData.email,
        nickname: registerData.nickname,
      })
        .then((result) => {
          toast.success(t('messages.registerSuccess'));
          authService.setTokens(result.accessToken, result.refreshToken);
          mutateProfile();
          completeAuthenticatedFlow({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          });
        })
        .catch((err: any) => {
          if (err?.name === 'NotAllowedError') {
            toast.info(t('passkey.cancelled'));
          } else {
            const errorMessage = err.response?.data?.message || err?.message;
            toast.error(errorMessage || t('messages.backendDown'));
          }
        })
        .finally(() => setDisbled(false));
      return;
    }

    // Has password → standard registration
    post('/auth/register', registerData)
      .then((response) => {
        toast.success(t('messages.registerSuccess'));
        setDisbled(false);
        setRegisterData({
          username: '',
          password: '',
          email: '',
          nickname: '',
        });

        const { accessToken, refreshToken } = response.data;
        if (accessToken && refreshToken) {
          authService.setTokens(accessToken, refreshToken);

          if (isIosLoginFlow) {
            mutateProfile();
            completeAuthenticatedFlow({ accessToken, refreshToken });
          } else if (passkeyEnabled) {
            // Has password, passkey optional → show passkey prompt with skip
            setShowPasskeyPrompt(true);
          } else {
            mutateProfile();
            completeAuthenticatedFlow({ accessToken, refreshToken });
          }
        } else {
          setActiveTab('login');
        }
      })
      .catch((err: any) => {
        setDisbled(false);
        const errorMessage = err.response?.data?.message;
        toast.error(errorMessage || t('messages.backendDown'));
      });
  }

  function handleLoginFieldChange(key: keyof LoginData, value: string) {
    setLoginData((prevState) => ({
      ...prevState,
      [key]: value,
    }));
  }

  function handleRegisterFieldChange(key: keyof RegisterData, value: string) {
    setRegisterData((prevState) => ({
      ...prevState,
      [key]: value,
    }));
  }

  async function setupPasskeyAfterRegister() {
    const success = await registerPasskey();
    if (success) {
      mutateProfile();
      completeAuthenticatedFlow();
    }
  }

  function skipPasskeyAfterRegister() {
    mutateProfile();
    completeAuthenticatedFlow();
  }

  async function loginWithPasskey() {
    const result = await authenticateWithPasskey();
    if (result) {
      mutateProfile();
      completeAuthenticatedFlow({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
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
      // 根据提供商显示不同的成功消息（如果有特定消息）
      if (provider === 'apple') {
        toast.success(t('messages.appleLoginSuccess'));
      } else {
        toast.success(t('messages.oauthLoginSuccess'));
      }
      mutateProfile();

      // 检查是否为 iOS web 登录流程
      if (isIosLoginFlow) {
        redirectToIosLogin(token, refreshToken);
        return;
      }

      // 清除 URL 参数并重定向
      navigate(postLoginRedirect, { replace: true });
    } else if (oauthStatus === 'error' && errorMessage) {
      // OAuth 登录失败
      toast.error(decodeURIComponent(errorMessage));
      // 清除 URL 参数
      navigate(getLoginPathWithRedirect(postLoginRedirect), { replace: true });
    } else if (oauthStatus === 'cancelled') {
      // 用户取消授权
      const provider = searchParams.get('provider');
      // 根据提供商显示不同的取消消息（如果有特定消息）
      if (provider === 'apple') {
        toast.info(t('messages.appleCancelled'));
      } else {
        toast.info(t('messages.oauthCancelled'));
      }
      // 清除 URL 参数
      navigate(getLoginPathWithRedirect(postLoginRedirect), { replace: true });
    }
  }, [searchParams, navigate, mutateProfile, t, isIosLoginFlow, postLoginRedirect]);

  // 通用 OAuth 登录处理函数
  function handleOAuthLogin(provider: string) {
    const iosLogin = isIosLoginFlow;
    const redirectUrl = iosLogin
      ? '/login?type=ioslogin'
      : `/login${redirectTarget ? `?redirect=${encodeURIComponent(redirectTarget)}` : ''}`;
    // 使用完整的 API URL
    const oauthUrl = `${getApiUrl()}/auth/oauth/${provider}?type=${iosLogin ? 'ioslogin' : 'web'}&redirect=${encodeURIComponent(redirectUrl)}`;
    window.location.href = oauthUrl;
  }

  return (
    <div className="relative flex h-dvh w-full items-center justify-center">
      <div className="animate-show text-primary z-10 flex w-96 flex-col gap-2 rounded-lg px-2 py-6 pb-10 opacity-0">
        {isCheckingStatus ? (
          <LoadingPlaceholder className="py-8" size={6} />
        ) : profile && isIosLoginFlow ? (
          <IosAuthorizePanel
            profile={profile}
            onAuthorize={authorizeIosLogin}
            onSwitchAccount={() => {
              authService.logout(false);
              mutateProfile(undefined, { revalidate: false });
            }}
          />
        ) : (
          <StandardLoginPanel
            activeTab={activeTab}
            allowRegistration={backendStatusOk?.ui?.allowRegistration !== false}
            backendStatusOk={backendStatusOk}
            disabled={disbled}
            isAuthenticating={isAuthenticating}
            isRegistering={isRegistering}
            loginData={loginData}
            oauthProviders={
              backendStatusOk?.oauth?.enabled ? backendStatusOk.oauth.providers : undefined
            }
            passkeyEnabled={passkeyEnabled}
            registerData={registerData}
            showPasskeyPrompt={showPasskeyPrompt}
            onActiveTabChange={setActiveTab}
            onLogin={login}
            onLoginFieldChange={handleLoginFieldChange}
            onOAuthLogin={handleOAuthLogin}
            onPasskeyLogin={loginWithPasskey}
            onRegister={register}
            onRegisterFieldChange={handleRegisterFieldChange}
            onSetupPasskey={setupPasskeyAfterRegister}
            onSkipPasskey={skipPasskeyAfterRegister}
          />
        )}
      </div>
    </div>
  );
}

export default Login;
