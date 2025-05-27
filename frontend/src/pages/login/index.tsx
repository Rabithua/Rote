import { loginByPassword, registerBypassword } from '@/api/login/main';
import { apiGetStatus } from '@/api/rote/main';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import mainJson from '@/json/main.json';
import { getMyProfile } from '@/api/user/main';
import LoadingPlaceholder from '@/components/LoadingPlaceholder';
import Logo from '@/components/logo';
import type { Profile } from '@/types/main';
import { useAPIGet } from '@/utils/fetcher';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';
const { safeRoutes } = mainJson;

function Login() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.login',
  });

  const { data: backendStatusOk, isLoading: isCheckingStatus } = useAPIGet(
    'checkStatus',
    apiGetStatus
  );

  const { data: profile, mutate } = useAPIGet<Profile>('profile', getMyProfile);

  const [type, setType] = useState('login');
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

    const toastId = toast.loading(t('messages.loggingIn'));
    setDisbled(true);
    loginByPassword(loginData)
      .then(async (res) => {
        toast.success(t('messages.loginSuccess'), {
          id: toastId,
        });
        setDisbled(false);
        mutate();
        navigate('/home');
      })
      .catch((err) => {
        console.log(err);
        setDisbled(false);
        if ('code' in err.response?.data) {
          toast.error(err.response.data.msg, {
            id: toastId,
          });
        } else {
          toast.error(t('messages.backendDown'), {
            id: toastId,
          });
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

    const toastId = toast.loading(t('messages.registering'));
    setDisbled(false);
    registerBypassword(registerData)
      .then(() => {
        toast.success(t('messages.registerSuccess'), {
          id: toastId,
        });
        setDisbled(false);
        setRegisterData({
          username: '',
          password: '',
          email: '',
          nickname: '',
        });
        setType('login');
      })
      .catch((err) => {
        setDisbled(false);
        toast.error(err.response.data.msg, {
          id: toastId,
        });
      });
  }

  function handleInputChange(e: any, key: string) {
    if (type === 'login') {
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

  function changeType() {
    setType(type === 'login' ? 'register' : 'login');
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
    } else {
    }
  }, [profile, navigate]);

  return (
    <div className="dark:bg-bgDark bg-bgLight relative flex h-dvh w-full items-center justify-center">
      <div className="animate-show dark:bg-opacityDark shadow-card z-10 flex w-80 translate-y-5 flex-col gap-2 rounded-lg px-8 py-6 pb-10 opacity-0 dark:text-white">
        {isCheckingStatus ? (
          <LoadingPlaceholder className="py-8" size={6} />
        ) : backendStatusOk ? (
          <>
            <div className="mb-4">
              <Logo className="w-32" color="#07C160" />
            </div>
            <div className="flex flex-col gap-2">
              {type === 'login' ? (
                <>
                  <div className="text-md">{t('fields.username')}</div>
                  <Input
                    placeholder="username"
                    className="text-md rounded-md font-mono"
                    maxLength={20}
                    value={loginData.username}
                    onInput={(e) => handleInputChange(e, 'username')}
                  />
                  <div className="text-md">{t('fields.password')}</div>
                  <Input
                    placeholder="possword"
                    type="password"
                    className="text-md rounded-md font-mono"
                    maxLength={30}
                    value={loginData.password}
                    onInput={(e) => handleInputChange(e, 'password')}
                    onKeyDown={handleLoginKeyDown}
                  />
                </>
              ) : (
                <>
                  <div className="text-md">{t('fields.username')}</div>
                  <Input
                    placeholder="username"
                    className="text-md rounded-md font-mono"
                    maxLength={20}
                    value={registerData.username}
                    onInput={(e) => handleInputChange(e, 'username')}
                  />
                  <div className="text-md">{t('fields.email')}</div>
                  <Input
                    placeholder="someone@mail.com"
                    className="text-md rounded-md font-mono"
                    maxLength={20}
                    value={registerData.email}
                    onInput={(e) => handleInputChange(e, 'email')}
                  />
                  <div className="text-md">{t('fields.nickname')}</div>
                  <Input
                    placeholder="nickname"
                    className="text-md rounded-md font-mono"
                    maxLength={20}
                    value={registerData.nickname}
                    onInput={(e) => handleInputChange(e, 'nickname')}
                  />

                  <div className="text-md">{t('fields.password')}</div>
                  <Input
                    placeholder="possword"
                    type="password"
                    className="text-md rounded-md font-mono"
                    maxLength={30}
                    value={registerData.password}
                    onInput={(e) => handleInputChange(e, 'password')}
                    onKeyDown={handleRegisterKeyDown}
                  />
                </>
              )}
              <div className="mt-4 flex flex-col gap-2">
                {type === 'login' ? (
                  <>
                    <button
                      className="w-full cursor-pointer rounded-md bg-black px-3 py-2 text-center text-white duration-300 active:scale-95"
                      disabled={disbled}
                      onClick={login}
                    >
                      {t('buttons.login')}
                    </button>
                    <button
                      className="bg-bgLight w-full cursor-pointer rounded-md px-3 py-2 text-center duration-300 active:scale-95 dark:text-black"
                      disabled={disbled}
                      onClick={changeType}
                    >
                      {t('buttons.register')}
                    </button>
                  </>
                ) : (
                  <>
                    <div
                      className="w-full cursor-pointer rounded-md bg-black px-3 py-2 text-center text-white duration-300 active:scale-95"
                      onClick={register}
                    >
                      {t('buttons.register')}
                    </div>
                    <div
                      className="bg-bgLight w-full cursor-pointer rounded-md px-3 py-2 text-center duration-300 active:scale-95 dark:text-black"
                      onClick={changeType}
                    >
                      {t('buttons.back')}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex cursor-pointer items-center justify-center gap-1 duration-300 active:scale-95">
              <Link to="/explore">
                <div className="duration-300 hover:opacity-60">{t('nav.explore')}</div>
              </Link>
              <span className="px-2">/</span>
              <Link to="/landing">
                <div className="duration-300 hover:opacity-60">{t('nav.home')}</div>
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className=" ">{t('error.backendIssue')}</div>
            <div>{JSON.stringify(backendStatusOk)}</div>
            <div className="text-gray-500">{t('error.dockerDeployment')}</div>
          </>
        )}
      </div>
    </div>
  );
}

export default Login;
