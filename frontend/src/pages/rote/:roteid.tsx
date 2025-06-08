import LoadingPlaceholder from '@/components/LoadingPlaceholder';
import NavBar from '@/components/navBar';
import RoteItem from '@/components/roteItem';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';

import type { Rote } from '@/types/main';
import { get } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { Navigation, Rss, User } from 'lucide-react';
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
  } = useAPIGet<Rote>(roteid || '', () => get('/notes/' + roteid).then((res) => res.data));

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
      <NavBar />
      <RoteItem rote={rote} />
      {rote.author && (
        <Link to={`/${rote.author.username}`}>
          <div className="bg-background/90 fixed right-0 bottom-16 left-0 z-30 mx-auto flex w-fit cursor-pointer items-center justify-center gap-4 rounded-full border px-6 py-2 backdrop-blur-xl duration-300 hover:scale-95 md:hidden">
            <Avatar className="text-primary bg-foreground/5 size-10">
              {rote?.author.avatar ? (
                <AvatarImage src={rote.author.avatar} />
              ) : (
                <AvatarFallback>
                  <User className="text-primary size-4" />
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex items-center gap-2">
              <div className="text-primary text-base font-semibold">{rote?.author.nickname}</div>
            </div>
          </div>
        </Link>
      )}
    </ContainerWithSideBar>
  ) : (
    <div className="flex h-full w-full items-center justify-center">{error}</div>
  );
}

export default SingleRotePage;
