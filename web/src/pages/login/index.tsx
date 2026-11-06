import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import { useSiteStatus } from '@/hooks/useSiteStatus';
import { get, getApiUrl, publicPost } from '@/utils/api';
import { authService } from '@/utils/auth';
import { useAPIGet } from '@/utils/fetcher';
import { getLoginPathWithRedirect, getSafeLoginRedirect } from '@/utils/loginRedirect';
import { isPasskeySupported } from '@/utils/passkey';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getAuthErrorMessage, getOAuthCallbackError } from './authErrors';
import { IosAuthorizePanel } from './components/IosAuthorizePanel';
import { OAuthRegistrationPanel } from './components/OAuthRegistrationPanel';
import { StandardLoginPanel } from './components/StandardLoginPanel';
import { AuthScreen } from './components/AuthScreen';
import type { AuthenticationTokens, AuthView, LoginData, RegisterData } from './types';
import { useAccountRegistration } from './useAccountRegistration';
import { usePasskeyContinuation } from './usePasskeyContinuation';
import { createLoginDataSchema, getZodErrorMessage } from './validation';

function Login() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.login' });
  const { data: siteStatus, isLoading: isCheckingStatus, error: siteStatusError } = useSiteStatus();
  const { data: profile, mutate: mutateProfile } = useAPIGet(
    authService.hasValidAccessToken() ? '/users/me/profile' : null,
    () => get('/users/me/profile').then((response) => response.data)
  );
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<AuthView>('primary');
  const [isRedirectingToIos, setIsRedirectingToIos] = useState(false);
  const [supportsPasskey] = useState(isPasskeySupported);
  const [loginData, setLoginData] = useState<LoginData>({ username: '', password: '' });
  const [registerData, setRegisterData] = useState<RegisterData>({
    username: '',
    password: '',
    email: '',
    nickname: '',
  });
  const isIosLoginFlow = searchParams.get('type') === 'ioslogin';
  const isOAuthRegistration = searchParams.get('oauth') === 'register';
  const isIosOAuthCallback =
    isIosLoginFlow &&
    searchParams.get('oauth') === 'success' &&
    Boolean(searchParams.get('token') && searchParams.get('refreshToken'));
  const redirectTarget = searchParams.get('redirect');
  const postLoginRedirect = getSafeLoginRedirect(searchParams);
  const passkeyEnabled =
    Boolean(siteStatus) && siteStatus?.passkey?.enabled !== false && supportsPasskey;
  const retryLoginPath = `${getLoginPathWithRedirect(postLoginRedirect)}${isIosLoginFlow ? '&type=ioslogin' : ''}`;

  function redirectToIosLogin(accessToken: string, refreshToken: string) {
    setIsRedirectingToIos(true);
    const params = new URLSearchParams({ token: accessToken, refreshToken });
    window.location.href = `rote://callback?${params.toString()}`;
  }

  function completeAuthenticatedFlow(tokens?: AuthenticationTokens) {
    if (!isIosLoginFlow) {
      navigate(postLoginRedirect, { replace: true });
      return;
    }
    const accessToken = tokens?.accessToken ?? authService.getAccessToken();
    const refreshToken = tokens?.refreshToken ?? authService.getRefreshToken();
    if (accessToken && refreshToken) redirectToIosLogin(accessToken, refreshToken);
    else toast.error(t('messages.tokenNotFound'));
  }

  function authenticated(tokens: AuthenticationTokens) {
    authService.setTokens(tokens.accessToken, tokens.refreshToken);
    mutateProfile();
    completeAuthenticatedFlow(tokens);
  }

  const registration = useAccountRegistration({
    registerData,
    siteStatus,
    onAuthenticated: authenticated,
  });
  const passkey = usePasskeyContinuation({
    username: registerData.username,
    onAuthenticated: authenticated,
  });
  const disabled = isLoggingIn || passkey.isContinuing || registration.isRegistering || !siteStatus;

  async function login() {
    const validation = createLoginDataSchema(t).safeParse(loginData);
    if (!validation.success) {
      toast.error(getZodErrorMessage(validation.error, t('passwordRequired')));
      return;
    }
    setIsLoggingIn(true);
    try {
      const { data } = await publicPost('/auth/login', validation.data);
      toast.success(t('messages.loginSuccess'));
      authenticated(data);
    } catch (error) {
      toast.error(getAuthErrorMessage(error, t, 'messages.loginFailed'));
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleOAuthLogin(provider: string) {
    const redirectUrl = isIosLoginFlow
      ? '/login?type=ioslogin'
      : `/login${redirectTarget ? `?redirect=${encodeURIComponent(redirectTarget)}` : ''}`;
    window.location.href = `${getApiUrl()}/auth/oauth/${provider}?type=${isIosLoginFlow ? 'ioslogin' : 'web'}&redirect=${encodeURIComponent(redirectUrl)}`;
  }

  useEffect(() => {
    if (siteStatusError) toast.error(t('messages.backendDown'));
  }, [siteStatusError, t]);

  useEffect(() => {
    if (window.location.hostname === 'demo.rote.ink')
      setLoginData({ username: 'guang', password: 'password' });
  }, []);

  useEffect(() => {
    if (authService.hasValidAccessToken()) mutateProfile();
  }, [mutateProfile]);

  useEffect(() => {
    const oauthStatus = searchParams.get('oauth');
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');
    const errorMessage = searchParams.get('message');
    if (oauthStatus === 'success' && token && refreshToken) {
      authService.setTokens(token, refreshToken);
      toast.success(
        t(
          searchParams.get('provider') === 'apple'
            ? 'messages.appleLoginSuccess'
            : 'messages.oauthLoginSuccess'
        )
      );
      mutateProfile();
      if (isIosLoginFlow) redirectToIosLogin(token, refreshToken);
      else navigate(postLoginRedirect, { replace: true });
    } else if (oauthStatus === 'error') {
      toast.error(
        getOAuthCallbackError(searchParams.get('errorCode'), t) ||
          errorMessage ||
          t('messages.loginFailed')
      );
      navigate(retryLoginPath, { replace: true });
    } else if (oauthStatus === 'cancelled') {
      toast.info(
        t(
          searchParams.get('provider') === 'apple'
            ? 'messages.appleCancelled'
            : 'messages.oauthCancelled'
        )
      );
      navigate(retryLoginPath, { replace: true });
    }
  }, [searchParams, navigate, mutateProfile, t, isIosLoginFlow, postLoginRedirect, retryLoginPath]);

  return (
    <AuthScreen>
      {isCheckingStatus || (isIosLoginFlow && isRedirectingToIos) || isIosOAuthCallback ? (
        <LoadingPlaceholder className="py-8" size={6} />
      ) : isOAuthRegistration ? (
        <OAuthRegistrationPanel
          registrationToken={searchParams.get('registrationToken') ?? ''}
          siteStatus={siteStatus}
          onBack={() => navigate(retryLoginPath, { replace: true })}
          onComplete={(tokens, completionUrl) => {
            authService.setTokens(tokens.accessToken, tokens.refreshToken);
            if (isIosLoginFlow) setIsRedirectingToIos(true);
            window.location.assign(completionUrl);
          }}
        />
      ) : profile && isIosLoginFlow ? (
        <IosAuthorizePanel
          profile={profile}
          onAuthorize={() => completeAuthenticatedFlow()}
          onSwitchAccount={() => {
            authService.logout(false);
            mutateProfile(undefined, { revalidate: false });
          }}
        />
      ) : (
        <StandardLoginPanel
          activeTab={activeTab}
          allowRegistration={siteStatus?.ui?.allowRegistration !== false}
          disabled={disabled}
          loginData={loginData}
          oauthProviders={siteStatus?.oauth?.enabled ? siteStatus.oauth.providers : undefined}
          passkeyEnabled={passkeyEnabled}
          registerData={registerData}
          onActiveTabChange={setActiveTab}
          onLogin={login}
          onLoginFieldChange={(key, value) => setLoginData((data) => ({ ...data, [key]: value }))}
          onOAuthLogin={handleOAuthLogin}
          onRegister={registration.register}
          onPasskeyContinue={passkey.continueWithUsername}
          onRegisterFieldChange={(key, value) =>
            setRegisterData((data) => ({ ...data, [key]: value }))
          }
        />
      )}
    </AuthScreen>
  );
}

export default Login;
