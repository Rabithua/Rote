import defaultCover from '@/assets/img/defaultCover.png';
import NavBar from '@/components/layout/navBar';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import RoteList from '@/components/rote/roteList';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import type { ApiGetRotesParams, Profile, Rotes } from '@/types/main';
import { API_URL, get } from '@/utils/api';
import { useAPIGet, useAPIInfinite } from '@/utils/fetcher';
import { getRotesV2 } from '@/utils/roteApi';
import { Helmet } from '@dr.pogodin/react-helmet';
import Linkify from 'linkify-react';
import { Globe2, RefreshCw, Rss, Stars, User } from 'lucide-react';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

function UserPage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.user' });
  const navigate = useNavigate();
  const { username }: any = useParams();
  const { data: userInfo, isLoading } = useAPIGet<Profile>(
    username,
    () => get('/users/' + username).then((res) => res.data),
    {
      onError: (err) => {
        if (err.response?.status === 404 || err.response?.status === 500) {
          navigate('/404');
        }
      },
    }
  );

  const getPropsUserPublic = (
    pageIndex: number,
    _previousPageData: Rotes | null
  ): ApiGetRotesParams | null => ({
    apiType: 'userPublic',
    params: {
      username: username,
      skip: pageIndex * 20,
      limit: 20,
    },
  });

  const {
    data,
    mutate,
    loadMore,
    isLoading: isRoteLoading,
    isValidating,
  } = useAPIInfinite(getPropsUserPublic, getRotesV2, {
    initialSize: 0,
    revalidateFirstPage: false,
  });

  const refreshData = () => {
    if (isRoteLoading || isValidating) {
      return;
    }
    mutate();
  };

  const SideBar = () => (
    <div className="grid grid-cols-3 divide-x-1 border-b">
      <a
        href={`${API_URL}/rss/${username}`}
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
  );

  return isLoading ? (
    <LoadingPlaceholder className="h-dvh w-full" size={6} />
  ) : (
    <>
      <Helmet>
        <title>{userInfo?.nickname || userInfo?.username || t('helmet.loading')}</title>
        <meta name="description" content={userInfo?.description || t('helmet.defaultDesc')} />
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${userInfo?.nickname || userInfo?.username} RSS`}
          href={`${API_URL}/rss/${username}`}
        />
      </Helmet>

      <ContainerWithSideBar
        sidebar={<SideBar />}
        sidebarHeader={
          <div className="flex items-center gap-2 p-4 text-lg font-semibold">
            <div className="flex items-center gap-2">
              <Stars className="size-5" />
              {t('sideBarTitle')}
            </div>
          </div>
        }
      >
        <NavBar
          title={
            <>
              <Avatar className="bg-background size-6 shrink-0 border sm:block">
                {userInfo?.avatar ? (
                  <AvatarImage src={userInfo.avatar} />
                ) : (
                  <AvatarFallback>
                    <User className="size-4 text-[#00000010]" />
                  </AvatarFallback>
                )}
              </Avatar>
              <span>{userInfo?.nickname || userInfo?.username}</span>
            </>
          }
          onNavClick={refreshData}
        >
          {isLoading ||
            (isValidating && (
              <RefreshCw className="text-primary ml-auto size-4 animate-spin duration-300" />
            ))}
        </NavBar>
        <div className="pb-4">
          <div className="relative aspect-[3] max-h-80 w-full overflow-hidden">
            <img
              className="h-full w-full object-cover"
              src={userInfo?.cover || defaultCover}
              alt=""
            />
          </div>
          <div className="mx-4 flex h-16">
            {/* 主页顶部头像展示，shadcn Avatar 不支持 size 属性，直接用 className 控制尺寸 */}
            <Avatar className="bg-background size-20 shrink-0 translate-y-[-50%] border-[4px] sm:block">
              {userInfo?.avatar ? (
                <AvatarImage src={userInfo.avatar} />
              ) : (
                <AvatarFallback>
                  <User className="size-4 text-[#00000010]" />
                </AvatarFallback>
              )}
            </Avatar>
          </div>
          <div className="mx-4 flex flex-col gap-1">
            <div className="text-2xl font-semibold">{userInfo?.nickname}</div>
            <div className="text-info text-base">@{userInfo?.username}</div>
            <div className="text-base">
              <div className="aTagStyle break-words whitespace-pre-line">
                <Linkify>{(userInfo?.description as any) || t('noDescription')}</Linkify>
              </div>
            </div>
            <div className="text-info text-base">
              {`${t('registerTime')}${moment.utc(userInfo?.createdAt).format('YYYY/MM/DD HH:mm:ss')}`}
            </div>
          </div>
        </div>

        <div className="bg-background flex w-full items-center gap-2 px-2 py-4 text-lg font-semibold">
          <Globe2 className="ml-2 size-6" />
          {t('publicNotes')}
        </div>

        {userInfo && <RoteList data={data} loadMore={loadMore} mutate={mutate} />}
      </ContainerWithSideBar>
    </>
  );
}

export default UserPage;
