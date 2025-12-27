import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { loadProfileAtom, profileAtom } from '@/state/profile';
import { tagsAtom } from '@/state/tags';
import { authService } from '@/utils/auth';
import { isTokenValid } from '@/utils/main';
import { useAtomValue, useSetAtom } from 'jotai';
import { Archive, Globe2, Home, LogIn, LogOut, Shield, Snail, User } from 'lucide-react';
import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

interface IconType {
  svg: JSX.Element;
  link?: string;
  name: string;
  callback?: () => void;
}

// 基础 tabs（所有登录用户）
const baseTabs: IconType[] = [
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
];

// 管理员 tabs（仅管理员可见）
const adminTabs: IconType[] = [
  {
    svg: <Shield className="size-4" />,
    link: '/admin',
    name: 'admin',
  },
];

export const tabsData: IconType[][] = [
  [
    ...baseTabs,
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
  const loadProfile = useSetAtom(loadProfileAtom);
  const setProfile = useSetAtom(profileAtom);
  const setTags = useSetAtom(tagsAtom);
  const profile = useAtomValue(profileAtom);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  useEffect(() => {
    if (isTokenValid()) {
      loadProfile();
    }
  }, [loadProfile]);

  const { t } = useTranslation('translation', { keyPrefix: 'pages.mine' });

  // 根据用户角色动态生成 tabs
  const userTabs = useMemo(() => {
    const tabs = [...baseTabs];
    // 如果是管理员或超级管理员，添加管理员 tab
    if (profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
      tabs.splice(tabs.length - 1, 0, ...adminTabs);
    }
    tabs.push({
      svg: <LogOut className="size-4" />,
      name: 'logout',
    });
    return tabs;
  }, [profile]);

  async function logOutFn() {
    setIsLogoutDialogOpen(false);
    const toastId = toast.loading(t('messages.loggingOut'));

    try {
      authService.logout(false);
      // 重置全局缓存，避免脏数据泄露到下一会话
      setProfile(undefined as any);
      setTags(null);

      setTimeout(() => {
        window.location.reload();
      }, 500);

      toast.success(t('messages.logoutSuccess'), {
        id: toastId,
      });
    } catch {
      toast.error(t('messages.logoutFailed'), {
        id: toastId,
      });
    }
  }

  function IconRenderItem(icon: IconType) {
    return icon.link ? (
      <Link key={icon.link} to={icon.link}>
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
        onClick={() => setIsLogoutDialogOpen(true)}
      >
        {icon.svg}
        <div className="hidden shrink-0 tracking-widest xl:block">
          {t(`leftNavBar.${icon.name}`)}
        </div>
      </div>
    ) : null;
  }

  return (
    <>
      <div className="bg-background text-primary mx-auto w-full max-w-6xl">
        <div className="mx-auto flex w-dvw max-w-[1440px] font-sans sm:divide-x xl:w-[90%]">
          <div className="bg-background/90 text-primary fixed bottom-0 z-10 flex w-full shrink-0 flex-row items-start justify-around px-1 py-2 pb-6 backdrop-blur-xl sm:sticky sm:top-0 sm:h-dvh sm:w-fit sm:flex-col sm:justify-center sm:gap-4 sm:px-2 xl:w-[200px] xl:px-4">
            {isTokenValid()
              ? userTabs.map((icon) => IconRenderItem(icon))
              : tabsData[1].map((icon) => IconRenderItem(icon))}
          </div>

          <div className="relative min-w-0 flex-1 overflow-visible">
            <Outlet />
          </div>
        </div>

        <Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('messages.logoutConfirmTitle')}</DialogTitle>
              <DialogDescription>{t('messages.logoutConfirmDescription')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsLogoutDialogOpen(false)}>
                {t('messages.cancel')}
              </Button>
              <Button variant="destructive" onClick={logOutFn}>
                {t('messages.logoutConfirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

export default LayoutDashboard;
