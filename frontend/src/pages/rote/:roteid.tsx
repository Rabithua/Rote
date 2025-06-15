import NavBar from '@/components/layout/navBar';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import RoteItem from '@/components/rote/roteItem';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';

import type { Rote } from '@/types/main';
import { get } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { Navigation, RefreshCw, Rss, User } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

function SingleRotePage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.rote' });
  const navigate = useNavigate();
  const { roteid } = useParams();

  const {
    data: rote,
    isLoading,
    error,
    mutate,
    isValidating,
  } = useAPIGet<Rote>(roteid || '', () => get('/notes/' + roteid).then((res) => res.data));

  const refreshData = () => {
    if (isLoading || isValidating) {
      return;
    }
    mutate();
  };

  useEffect(() => {
    if (!roteid) {
      navigate('/404');
    }
  }, [roteid, navigate]);

  if (!roteid) {
    return null;
  }

  const SideBar = () =>
    isLoading ? (
      <LoadingPlaceholder className="py-8" size={6} />
    ) : (
      <div className="">
        {rote?.author && (
          <div className="border-b p-4">
            <Link to={`/${rote.author.username}`} className="block">
              <div className="flex items-center gap-3">
                <Avatar className="bg-foreground/5 text-primary size-12">
                  {rote.author.avatar ? (
                    <AvatarImage src={rote.author.avatar} />
                  ) : (
                    <AvatarFallback>
                      <User className="text-info size-6" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-primary truncate font-semibold">{rote.author.nickname}</div>
                  <div className="text-info truncate text-sm">@{rote.author.username}</div>
                </div>
              </div>
            </Link>
          </div>
        )}
        <div className="grid grid-cols-3 divide-x-1 border-b">
          <a
            href={`${process.env.REACT_APP_BASEURL_PRD || 'http://localhost:3000'}/v1/api/rss/${rote?.author?.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-foreground/3 flex cursor-pointer items-center justify-center gap-2 py-4"
          >
            <Rss className="size-5" />
            <div className="text-xl">RSS</div>
          </a>
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="text-xl">☝️</div>
          </div>
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="text-xl">🤓</div>
          </div>
        </div>
      </div>
    );

  return isLoading ? (
    <LoadingPlaceholder className="py-16" size={6} />
  ) : rote ? (
    <ContainerWithSideBar
      sidebar={<SideBar />}
      sidebarHeader={
        <div className="flex items-center gap-2 p-4 text-lg font-semibold">
          <Navigation className="size-5" />
          <div className="flex h-8 items-center gap-2">{t('sideBarTitle')}</div>
        </div>
      }
      className="pb-16"
    >
      <NavBar
        onNavClick={refreshData}
        title={
          <Link to={`/${rote.author?.username}`} className="flex items-center gap-2 md:hidden">
            <Avatar className="bg-background size-6 shrink-0 border sm:block">
              {rote.author?.avatar ? (
                <AvatarImage src={rote.author?.avatar} />
              ) : (
                <AvatarFallback>
                  <User className="size-4 text-[#00000010]" />
                </AvatarFallback>
              )}
            </Avatar>
            <span>{rote.author?.nickname || rote.author?.username}</span>
          </Link>
        }
      >
        {isLoading ||
          (isValidating && (
            <RefreshCw className="text-primary ml-auto size-4 animate-spin duration-300" />
          ))}
      </NavBar>
      <RoteItem rote={rote} mutateSingle={mutate} />
    </ContainerWithSideBar>
  ) : (
    <div className="flex h-full w-full items-center justify-center">{error}</div>
  );
}

export default SingleRotePage;
