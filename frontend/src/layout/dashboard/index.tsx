import LoadingPlaceholder from '@/components/LoadingPlaceholder';
import type { Profile } from '@/types/main';
import { get, post } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { Archive, Globe2, Home, LogIn, LogOut, Snail, User } from 'lucide-react';
import type { JSX } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation } from 'react-router-dom';

interface IconType {
  svg: JSX.Element;
  link?: string;
  name: string;
  callback?: () => void;
}

function LayoutDashboard() {
  const location = useLocation();
  const { data: profile, isLoading } = useAPIGet<Profile>('profile', () =>
    get('/users/me/profile').then((res) => res.data)
  );

  const { t } = useTranslation('translation', { keyPrefix: 'pages.mine' });

  const iconsData: IconType[][] = [
    [
      {
        svg: <Home className="size-4" />,
        link: '/home',
        name: 'home',
      },
      {
        svg: <Globe2 className="size-4" />,
        link: '/explore',
        name: 'explore',
      },

      {
        svg: <Archive className="size-4" />,
        link: '/archived',
        name: 'archived',
      },
      {
        svg: <User className="size-4" />,
        link: '/profile',

        name: 'profile',
      },
      {
        svg: <Snail className="size-4" />,
        link: '/experiment',
        name: 'experiment',
      },
      {
        svg: <LogOut className="size-4" />,
        name: 'logout',
        callback: logOutFn,
      },
    ],
    [
      {
        svg: <LogIn className="size-4" />,
        link: '/login',
        name: 'login',
      },
    ],
  ];

  function logOutFn() {
    const toastId = toast.loading(t('messages.loggingOut'));
    post('/auth/logout')
      .then(async () => {
        toast.success(t('messages.logoutSuccess'), {
          id: toastId,
        });

        window.location.reload();
      })
      .catch(() => {
        toast.error('err.response.data.data.msg', {
          id: toastId,
        });
      });
  }

  function IconRenderItem(icon: IconType) {
    return icon.link ? (
      <Link
        key={icon.link}
        to={icon.link}
        onClick={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      >
        <div
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-full p-2 px-3 text-base duration-300 hover:bg-[#00000010] dark:hover:bg-[#ffffff10] ${
            location.pathname === icon.link
              ? 'bg-bgDark text-textDark hover:bg-bgDark dark:bg-bgLight dark:text-textLight dark:hover:bg-bgLight'
              : ''
          } `}
        >
          {icon.svg}
          <div className="hidden shrink-0 tracking-widest lg:block">
            {t(`leftNavBar.${icon.name}`)}
          </div>
        </div>
      </Link>
    ) : (
      <div
        key={icon.name}
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-full p-2 px-3 text-base duration-300 hover:bg-[#00000010] dark:hover:bg-[#ffffff10] ${
          location.pathname === icon.link
            ? 'bg-bgDark text-textDark hover:bg-bgDark dark:bg-bgLight dark:text-textLight dark:hover:bg-bgLight'
            : ''
        } ${icon.name === 'logout' ? 'hover:bg-red-600/10 hover:text-red-600' : ''} `}
        onClick={() => {
          if (icon.callback) {
            icon.callback();
          }
        }}
      >
        {icon.svg}
        <div className="hidden shrink-0 tracking-widest lg:block">
          {t(`leftNavBar.${icon.name}`)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bgLight text-textLight dark:bg-bgDark dark:text-textDark mx-auto w-full max-w-6xl">
      <div className="mx-auto flex w-dvw max-w-[1440px] divide-x-1 font-sans lg:w-[90%]">
        <div className="bg-bgLight/90 text-textLight dark:bg-bgDark/90 dark:text-textDark fixed bottom-0 z-10 flex w-full shrink-0 flex-row items-start justify-around px-1 py-2 pb-5 backdrop-blur-xl sm:sticky sm:top-0 sm:h-dvh sm:w-fit sm:flex-col sm:justify-center sm:gap-4 sm:px-2 lg:w-[200px] lg:px-4">
          {isLoading ? (
            <LoadingPlaceholder className="py-8" size={6} />
          ) : profile ? (
            iconsData[0].map((icon) => IconRenderItem(icon))
          ) : (
            iconsData[1].map((icon) => IconRenderItem(icon))
          )}
        </div>

        <div className="relative min-w-0 flex-1 overflow-visible">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default LayoutDashboard;
