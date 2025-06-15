import { tabsData } from '@/layout/dashboard';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavHeaderProps {
  title?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  onNavClick?: () => void;
}

export default function NavBar({ title, icon, children, onNavClick }: NavHeaderProps) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.navBar',
  });
  const location = useLocation();
  const navigate = useNavigate();

  const mainNavPaths = tabsData
    .flat()
    .map((tab) => tab.link)
    .filter(Boolean);

  const isMainNavPage = mainNavPaths.includes(location.pathname);

  function back() {
    const doesAnyHistoryEntryExist = location.key !== 'default';
    if (doesAnyHistoryEntryExist) {
      navigate(-1);
    } else {
      navigate('/home');
    }
  }

  return (
    <>
      <div
        className={`noScrollBar bg-background/99 sticky top-0 z-10 flex w-full items-center gap-2 overflow-x-scroll px-2 py-4 text-lg font-semibold backdrop-blur-xl duration-300 ${onNavClick && 'cursor-pointer'}`}
        onClick={onNavClick}
      >
        <div className="flex items-center divide-x-1">
          {!isMainNavPage && (
            <div
              className="hover:text-theme flex cursor-pointer items-center gap-2 px-2 duration-300"
              onClick={(e) => {
                e.stopPropagation();
                back();
              }}
            >
              <ArrowLeft className="size-8 p-1" />
              <div>{t('back')}</div>
            </div>
          )}

          {(icon || title) && (
            <div className="flex items-center gap-2 px-2">
              {icon}
              {title}
            </div>
          )}
        </div>

        {children}
      </div>
    </>
  );
}
