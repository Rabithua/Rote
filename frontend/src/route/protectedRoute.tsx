import LoadingPlaceholder from '@/components/LoadingPlaceholder';
import { useIosSafariToastDone } from '@/state/iosSafariToastDone';
import type { Profile } from '@/types/main';
import { get } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import MobileDetect from 'mobile-detect';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { Navigate } from 'react-router-dom';

export const ProtectedRoute = ({ children }: any) => {
  const { data: profile, isLoading } = useAPIGet<Profile>('profile', () =>
    get('/users/me/profile').then((res) => res.data)
  );

  const [iosSafariToastDone, setIosSafariToastDone] = useIosSafariToastDone();

  const isIosSafari = () => {
    const md = new MobileDetect(window.navigator.userAgent);
    return md.os() === 'iOS' && md.userAgent() === 'Safari';
  };

  const isPwa = () => {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      ('serviceWorker' in navigator && navigator.serviceWorker.controller !== null)
    );
  };

  useEffect(() => {
    if (isPwa()) {
      return;
    }

    if (iosSafariToastDone) {
      return;
    }

    if (!isIosSafari()) {
      toast('iOS Safari 建议添加到桌面，体验更佳！', {
        icon: '🤖',
      });
      setIosSafariToastDone(true);
    }
  }, [iosSafariToastDone, setIosSafariToastDone]);

  return isLoading ? (
    <LoadingPlaceholder className="h-dvh w-dvw" size={6} />
  ) : profile ? (
    children
  ) : (
    <Navigate to="/login" />
  );
};
