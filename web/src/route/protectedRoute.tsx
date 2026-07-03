import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import { useAuthState } from '@/state/profile';
import { getLoginPathWithRedirect } from '@/utils/loginRedirect';
import MobileDetect from 'mobile-detect';
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

export const ProtectedRoute = ({ children }: any) => {
  const { tokenValid, isAuthPending } = useAuthState();
  const location = useLocation();
  const [iosSafariToastDone, setIosSafariToastDone] = useState(
    localStorage.getItem('iosSafariToastDone') === 'true'
  );

  const isIosSafari = () => {
    const md = new MobileDetect(window.navigator.userAgent);
    return md.os() === 'iOS' && md.userAgent() === 'Safari';
  };

  const isPwa = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    ('serviceWorker' in navigator && navigator.serviceWorker.controller !== null);

  useEffect(() => {
    if (isPwa()) {
      return;
    }

    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
    if (iosSafariToastDone) {
      return;
    }

    if (!isIosSafari()) {
      toast('iOS Safari 建议添加到桌面，体验更佳！', {
        icon: '🤖',
      });
      setIosSafariToastDone(true);
      localStorage.setItem('iosSafariToastDone', 'true');
    }
  }, [iosSafariToastDone, setIosSafariToastDone]);

  if (isAuthPending) {
    return <LoadingPlaceholder className="h-dvh w-full" size={6} />;
  }

  return tokenValid ? (
    children
  ) : (
    <Navigate replace to={getLoginPathWithRedirect(`${location.pathname}${location.search}`)} />
  );
};
