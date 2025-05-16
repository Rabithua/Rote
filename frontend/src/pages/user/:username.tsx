import { apiGetUserPublicRote } from '@/api/rote/main';
import { apiGetUserInfoByUsername } from '@/api/user/main';
import FloatBtns from '@/components/FloatBtns';
import LoadingPlaceholder from '@/components/LoadingPlaceholder';
import NavBar from '@/components/navBar';
import NavHeader from '@/components/navHeader';
import RoteList from '@/components/roteList';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import { Profile } from '@/types/main';
import { useAPIGet } from '@/utils/fetcher';
import { Avatar } from 'antd';
import { ChartLine, Globe2, Rss, Stars, User } from 'lucide-react';
import moment from 'moment';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Linkify from 'react-linkify';
import { useNavigate, useParams } from 'react-router-dom';

function UserPage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.user' });
  const navigate = useNavigate();
  const [drawOpen, setDrawOpen] = useState(false);
  const { username }: any = useParams();
  const { data: userInfo, isLoading } = useAPIGet<Profile>(username, apiGetUserInfoByUsername, {
    onError: (err) => {
      if (err.response?.status === 404 || err.response?.status === 500) {
        navigate('/404');
      }
    },
  });

  const SideBar = () => {
    return (
      <div className="grid grid-cols-3">
        <a
          href={`${process.env.REACT_APP_BASEURL_PRD || 'http://localhost:3000'}/v1/api/rss/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex cursor-pointer items-center justify-center gap-2 border-[0.5px] py-4 hover:bg-opacityLight dark:hover:bg-opacityDark"
        >
          <Rss className="size-5" />
          <div className="text-xl">RSS</div>
        </a>
        <div className="flex items-center justify-center gap-2 border-[0.5px] py-4">
          <div className="text-xl">☝️</div>
        </div>
        <div className="flex items-center justify-center gap-2 border-[0.5px] py-4">
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
          <div className="flex items-center gap-2 border-b p-4 text-lg font-semibold">
            <div className="flex h-8 items-center gap-2">
              <Stars className="size-5" />
              {t('sideBarTitle')}
            </div>
          </div>
        }
      >
        <NavBar />
        <div className="relative max-h-80 min-h-[1/5] w-full overflow-hidden">
          <img
            className="h-full min-h-20 w-full"
            src={userInfo?.cover || require('@/assets/img/defaultCover.png')}
            alt=""
          />
        </div>
        <div className="mx-4 flex h-16">
          <Avatar
            className="shrink-0 translate-y-[-50%] border-[4px] border-opacityLight bg-bgLight sm:block dark:border-opacityDark dark:bg-bgDark"
            size={{ xs: 80, sm: 80, md: 80, lg: 100, xl: 120, xxl: 120 }}
            icon={<User className="size-4 text-[#00000010]" />}
            src={userInfo?.avatar}
          />
        </div>
        <div className="mx-4 flex flex-col gap-1">
          <div className="text-2xl font-semibold">{userInfo?.nickname}</div>
          <div className="text-base text-gray-500">@{userInfo?.username}</div>
          <div className="text-base">
            <div className="aTagStyle whitespace-pre-line break-words">
              <Linkify>{(userInfo?.description as any) || t('noDescription')}</Linkify>
            </div>
          </div>
          <div className="text-base text-gray-500">
            {`${t('registerTime')}${moment.utc(userInfo?.createdAt).format('YYYY/MM/DD HH:mm:ss')}`}
          </div>
        </div>

        <NavHeader title={t('publicNotes')} icon={<Globe2 className="size-6" />} />

        {userInfo && (
          <RoteList
            api={apiGetUserPublicRote}
            apiProps={{
              limit: 20,
              username,
              filter: {},
            }}
          />
        )}

        <FloatBtns>
          <div
            className="block w-fit cursor-pointer rounded-md bg-bgDark px-4 py-2 text-textDark duration-300 hover:scale-105 md:hidden dark:bg-bgLight dark:text-textLight"
            onClick={() => setDrawOpen(!drawOpen)}
          >
            <ChartLine className="size-4" />
          </div>
        </FloatBtns>
      </ContainerWithSideBar>
    </>
  );
}

export default UserPage;
