import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import type { Profile } from '@/types/main';
import { get, post } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { Archive, Globe2, Home, LogIn, LogOut, Snail, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { JSX } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

interface IconType {
  svg: JSX.Element;
  link?: string;
  name: string;
  callback?: () => void;
}

export const tabsData: IconType[][] = [
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

function LayoutDashboard() {
  const location = useLocation();
  const { data: profile, isLoading } = useAPIGet<Profile>('profile', () =>
    get('/users/me/profile').then((res) => res.data)
  );

  const { t } = useTranslation('translation', { keyPrefix: 'pages.mine' });

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
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-full p-2 px-3 text-base duration-300 ${
            location.pathname === icon.link
              ? 'bg-foreground text-primary-foreground'
              : 'hover:bg-foreground/5'
          } `}
        >
          {icon.svg}
          <div className="hidden shrink-0 tracking-widest xl:block">
            {t(`leftNavBar.${icon.name}`)}
          </div>
        </div>
      </Link>
    ) : icon.name === 'logout' ? (
      <div
        key={icon.name}
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-full p-2 px-3 text-base duration-300 ${
          location.pathname === icon.link
            ? 'bg-foreground text-primary-foreground'
            : 'hover:bg-foreground/5'
        } ${icon.name === 'logout' ? 'hover:bg-red-600/10 hover:text-red-600' : ''} `}
        onClick={logOutFn}
      >
        {icon.svg}
        <div className="hidden shrink-0 tracking-widest xl:block">
          {t(`leftNavBar.${icon.name}`)}
        </div>
      </div>
    ) : null;
  }

  return (
    <div className="bg-background text-primary mx-auto w-full max-w-6xl">
      <div className="mx-auto flex w-dvw max-w-[1440px] font-sans sm:divide-x-1 xl:w-[90%]">
        <div className="bg-background/90 text-primary fixed bottom-0 z-10 flex w-full shrink-0 flex-row items-start justify-around px-1 py-2 pb-6 backdrop-blur-xl sm:sticky sm:top-0 sm:h-dvh sm:w-fit sm:flex-col sm:justify-center sm:gap-4 sm:px-2 xl:w-[200px] xl:px-4">
          {isLoading ? (
            <LoadingPlaceholder className="py-8" size={6} />
          ) : profile ? (
            tabsData[0].map((icon) => IconRenderItem(icon))
          ) : (
            tabsData[1].map((icon) => IconRenderItem(icon))
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
