import defaultCover from '@/assets/img/defaultCover.png';
import { VerifiedIcon } from '@/components/icons/Verified';
import UserSidebarLinks from '@/components/common/UserSidebarLinks';
import NavBar from '@/components/layout/navBar';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import PageRequestError from '@/components/others/PageRequestError';
import UserAvatar from '@/components/others/UserAvatar';
import RoteList from '@/components/rote/roteList';
import BlockedUserNotesState from '@/features/user-blocks/BlockedUserNotesState';
import { removeUserContentFromPages } from '@/features/user-blocks/cache';
import UserBlockMenu from '@/features/user-blocks/UserBlockMenu';
import { viewerAwareCacheKey } from '@/features/user-blocks/viewerCacheScope';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import { profileAtom } from '@/state/profile';
import type { ApiGetRotesParams, Profile, Rotes } from '@/types/main';
import { API_URL, get } from '@/utils/api';
import { isNotFoundError } from '@/utils/error';
import { useAPIGet, useAPIInfinite } from '@/utils/fetcher';
import { getRotesV2 } from '@/utils/roteApi';
import { Helmet } from '@dr.pogodin/react-helmet';
import Linkify from 'linkify-react';
import { Globe2, RefreshCw, Stars } from 'lucide-react';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useAtomValue } from 'jotai';

function UserPage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.user' });
  const navigate = useNavigate();
  const { username }: any = useParams();
  const currentProfile = useAtomValue(profileAtom);
  const {
    data: userInfo,
    isLoading,
    error,
    mutate: mutateUser,
  } = useAPIGet<Profile>(
    username ? viewerAwareCacheKey(`/users/${username}`, currentProfile?.id) : null,
    () => get('/users/' + username).then((res) => res.data),
    {
      onError: (err: unknown) => {
        if (isNotFoundError(err)) {
          navigate('/404', { replace: true });
        }
      },
    }
  );

  const hasValidUser = Boolean(
    userInfo && typeof userInfo === 'object' && userInfo.id && userInfo.username
  );
  const hasLoadFailure = Boolean(
    (error && !hasValidUser) || (!isLoading && !error && !hasValidUser)
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

  const handleBlockChanged = async (blocked: boolean) => {
    if (!userInfo) return;

    if (blocked) {
      await mutateUser({ ...userInfo, viewerHasBlocked: true }, { revalidate: false });
      await mutate(
        removeUserContentFromPages(data, {
          id: userInfo.id,
          username: userInfo.username,
        }),
        { revalidate: false }
      );
      return;
    }

    await mutate();
    await mutateUser({ ...userInfo, viewerHasBlocked: false }, { revalidate: false });
  };

  if (hasLoadFailure) {
    if (isNotFoundError(error)) {
      return null;
    }

    return (
      <PageRequestError
        error={error}
        onRetry={() => {
          void mutateUser();
        }}
      />
    );
  }

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
        sidebar={<UserSidebarLinks username={username} appLabel={t('downloadApp')} />}
        sidebarHeader={
          <div className="flex items-center gap-2 p-3 text-lg font-semibold">
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
              <UserAvatar
                avatar={userInfo?.avatar}
                className="bg-background size-6 shrink-0 border sm:block"
              />
              <span className="inline-flex items-center gap-1">
                {userInfo?.nickname || userInfo?.username}
                {userInfo?.certified && <VerifiedIcon className="text-theme size-4 shrink-0" />}
              </span>
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
          <div className="mx-4 flex h-16 items-center">
            {/* 主页顶部头像展示，shadcn Avatar 不支持 size 属性，直接用 className 控制尺寸 */}
            <UserAvatar
              avatar={userInfo?.avatar}
              className="bg-background size-20 shrink-0 translate-y-[-50%] border-[4px] sm:block"
              fallbackClassName="bg-muted/80"
            />
            {currentProfile?.id && userInfo?.id && currentProfile.id !== userInfo.id && (
              <div className="ml-auto flex items-center gap-2">
                <UserBlockMenu
                  blocked={userInfo.viewerHasBlocked === true}
                  targetDisplayName={userInfo.nickname || userInfo.username}
                  targetUserId={userInfo.id}
                  onChanged={handleBlockChanged}
                />
              </div>
            )}
          </div>
          <div className="mx-4 flex flex-col gap-1">
            <div className="inline-flex items-center gap-1 text-2xl font-semibold">
              {userInfo?.nickname}
              {userInfo?.certified && <VerifiedIcon className="text-theme size-5 shrink-0" />}
            </div>
            <div className="text-info text-base">@{userInfo?.username}</div>
            <div className="text-base">
              <div className="aTagStyle break-words whitespace-pre-line">
                <Linkify>{(userInfo?.description as any) || t('noDescription')}</Linkify>
              </div>
            </div>
            <div className="text-info text-base">
              {`${t('registerTime')}${moment(userInfo?.createdAt).local().format('YYYY/MM/DD HH:mm:ss')}`}
            </div>
          </div>
        </div>

        <div className="bg-background flex w-full items-center gap-2 px-2 py-4 text-lg font-semibold">
          <Globe2 className="ml-2 size-6" />
          {t('publicNotes')}
        </div>

        {userInfo ? (
          userInfo.viewerHasBlocked ? (
            <BlockedUserNotesState />
          ) : (
            <RoteList data={data} loadMore={loadMore} mutate={mutate} />
          )
        ) : null}
      </ContainerWithSideBar>
    </>
  );
}

export default UserPage;
