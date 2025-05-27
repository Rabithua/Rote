import LoadingPlaceholder from '@/components/LoadingPlaceholder';
import NavBar from '@/components/navBar';
import NavHeader from '@/components/navHeader';
import RoteList from '@/components/roteList';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import type { ApiGetRotesParams, Profile, Rotes } from '@/types/main';
import { get } from '@/utils/api';
import { useAPIGet, useAPIInfinite } from '@/utils/fetcher';
import { getRotesV2 } from '@/utils/roteApi';
import Linkify from 'linkify-react';
import { Globe2, Rss, Stars, User } from 'lucide-react';
import moment from 'moment';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

function UserPage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.user' });
  const navigate = useNavigate();
  const { username }: any = useParams();
  const { data: userInfo, isLoading } = useAPIGet<Profile>(
    username,
    (key) => get('/users/' + key).then((res) => res.data),
    {
      onError: (err) => {
        if (err.response?.status === 404 || err.response?.status === 500) {
          navigate('/404');
        }
      },
    }
  );

  const getPropsUserPublic = (pageIndex: number, _previousPageData: Rotes): ApiGetRotesParams => {
    return {
      apiType: 'userPublic',
      params: {
        username: username,
        skip: pageIndex * 20,
        limit: 20,
      },
    };
  };

  const { data, mutate, loadMore } = useAPIInfinite(getPropsUserPublic, getRotesV2, {
    initialSize: 0,
    revalidateFirstPage: false,
  });

  const SideBar = () => {
    return (
      <div className="grid grid-cols-3 divide-x-1 border-b">
        <a
          href={`${process.env.REACT_APP_BASEURL_PRD || 'http://localhost:3000'}/v1/api/rss/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:bg-opacityLight dark:hover:bg-opacityDark flex cursor-pointer items-center justify-center gap-2 py-4"
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
  };

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
          href={`${process.env.REACT_APP_BASEURL_PRD || 'http://localhost:3000'}/v1/api/rss/${username}`}
        />
      </Helmet>

      <ContainerWithSideBar
        sidebar={<SideBar />}
        sidebarHeader={
          <div className="flex items-center gap-2 p-4 text-lg font-semibold">
            <div className="flex h-8 items-center gap-2">
              <Stars className="size-5" />
              {t('sideBarTitle')}
            </div>
          </div>
        }
      >
        <NavBar />
        <div className="pb-4">
          <div className="relative aspect-[3] max-h-80 w-full overflow-hidden">
            <img
              className="h-full w-full"
              src={userInfo?.cover || require('@/assets/img/defaultCover.png')}
              alt=""
            />
          </div>
          <div className="mx-4 flex h-16">
            {/* 主页顶部头像展示，shadcn Avatar 不支持 size 属性，直接用 className 控制尺寸 */}
            <Avatar className="bg-bgLight dark:bg-bgDark size-20 shrink-0 translate-y-[-50%] border-[4px] sm:block">
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
            <div className="text-base text-gray-500">@{userInfo?.username}</div>
            <div className="text-base">
              <div className="aTagStyle break-words whitespace-pre-line">
                <Linkify>{(userInfo?.description as any) || t('noDescription')}</Linkify>
              </div>
            </div>
            <div className="text-base text-gray-500">
              {`${t('registerTime')}${moment.utc(userInfo?.createdAt).format('YYYY/MM/DD HH:mm:ss')}`}
            </div>
          </div>
        </div>

        <NavHeader title={t('publicNotes')} icon={<Globe2 className="size-6" />} />

        {userInfo && <RoteList data={data} loadMore={loadMore} mutate={mutate} />}
      </ContainerWithSideBar>
    </>
  );
}

export default UserPage;
