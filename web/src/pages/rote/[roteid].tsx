import { VerifiedIcon } from '@/components/icons/Verified';
import { RelatedNotesBlock } from '@/components/ai/RelatedNotesBlock';
import { viewerAwareCacheKey } from '@/features/user-blocks/viewerCacheScope';
import NavBar from '@/components/layout/navBar';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import PageRequestError from '@/components/others/PageRequestError';
import UserAvatar from '@/components/others/UserAvatar';
import RoteItem from '@/components/rote/roteItem';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import { usePermissions } from '@/hooks/usePermissions';
import { useSiteStatus } from '@/hooks/useSiteStatus';
import { profileAtom } from '@/state/profile';

import type { Rote } from '@/types/main';
import { API_URL, get } from '@/utils/api';
import { isNotFoundError } from '@/utils/error';
import { useAPIGet } from '@/utils/fetcher';
import { useAtomValue } from 'jotai';
import { Navigation, RefreshCw, Rss } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

function SingleRotePage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.rote' });
  const navigate = useNavigate();
  const { roteid } = useParams();
  const profile = useAtomValue(profileAtom);
  const { data: siteStatus } = useSiteStatus();
  const { capabilities } = usePermissions();

  const {
    data: rote,
    isLoading,
    error,
    mutate,
    isValidating,
  } = useAPIGet<Rote>(
    roteid ? viewerAwareCacheKey(`/notes/${roteid}`, profile?.id) : null,
    () => get('/notes/' + roteid).then((res) => res.data),
    {
      onError: (err: unknown) => {
        if (isNotFoundError(err)) {
          navigate('/404', { replace: true });
        }
      },
    }
  );

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

  const hasValidRote = Boolean(
    rote &&
    typeof rote === 'object' &&
    rote.id &&
    typeof rote.content === 'string' &&
    rote.author?.username
  );
  const hasLoadFailure = Boolean(
    (error && !hasValidRote) || (!isLoading && !error && !hasValidRote)
  );

  if (hasLoadFailure) {
    if (isNotFoundError(error)) {
      return null;
    }

    return (
      <PageRequestError
        error={error}
        onRetry={() => {
          void mutate();
        }}
      />
    );
  }

  const isOwner = Boolean(profile?.username && rote?.author?.username === profile.username);
  const canUseAi =
    siteStatus?.ai?.memoryAvailable === true && capabilities?.['ai.chat']?.allowed === true;

  const SideBar = () =>
    isLoading ? (
      <LoadingPlaceholder className="py-8" size={6} />
    ) : (
      <div className="">
        {rote?.author && (
          <div className="border-b p-4">
            <Link to={`/${rote.author.username}`} className="block">
              <div className="flex items-center gap-3">
                <UserAvatar
                  avatar={rote.author.avatar}
                  className="bg-foreground/5 text-primary size-12"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-primary inline-flex items-center gap-1 truncate font-semibold">
                    {rote.author.nickname}
                    {rote.author.certified && (
                      <VerifiedIcon className="text-theme size-4 shrink-0" />
                    )}
                  </div>
                  <div className="text-info truncate text-sm">@{rote.author.username}</div>
                </div>
              </div>
            </Link>
          </div>
        )}
        <div className="grid grid-cols-3 divide-x border-b">
          <a
            href={`${API_URL}/rss/${rote?.author?.username}`}
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
        <RelatedNotesBlock roteId={rote?.id} enabled={isOwner && canUseAi} />
      </div>
    );

  return isLoading ? (
    <LoadingPlaceholder className="py-16" size={6} />
  ) : rote ? (
    <ContainerWithSideBar
      sidebar={<SideBar />}
      sidebarHeader={
        <div className="flex items-center gap-2 p-3 text-lg font-semibold">
          <Navigation className="size-5" />
          <div className="flex items-center gap-2">{t('sideBarTitle')}</div>
        </div>
      }
      className="pb-16"
    >
      <NavBar onNavClick={refreshData}>
        {isLoading ||
          (isValidating && (
            <RefreshCw className="text-primary ml-auto size-4 animate-spin duration-300" />
          ))}
      </NavBar>
      <RoteItem
        showAvatar={false}
        rote={rote}
        mutateSingle={mutate}
        enableContentCollapse={false}
      />
    </ContainerWithSideBar>
  ) : null;
}

export default SingleRotePage;
