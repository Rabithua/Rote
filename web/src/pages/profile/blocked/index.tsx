import NavBar from '@/components/layout/navBar';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import PageRequestError from '@/components/others/PageRequestError';
import UserAvatar from '@/components/others/UserAvatar';
import { VerifiedIcon } from '@/components/icons/Verified';
import { viewerAwareCacheKey } from '@/features/user-blocks/viewerCacheScope';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import ProfileSidebar from '../components/ProfileSidebar';
import BlockUserButton from '@/features/user-blocks/BlockUserButton';
import { listBlockedUsers } from '@/features/user-blocks/api';
import type { BlockedUserSummary } from '@/types/main';
import { useAPIGet } from '@/utils/fetcher';
import { ShieldX, Stars } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { profileAtom } from '@/state/profile';
import { useAtomValue } from 'jotai';

export default function BlockedUsersPage() {
  const { t } = useTranslation('translation', { keyPrefix: 'userBlocks.management' });
  const profile = useAtomValue(profileAtom);
  const { data, error, isLoading, mutate } = useAPIGet<BlockedUserSummary[]>(
    viewerAwareCacheKey('/users/me/blocks', profile?.id),
    listBlockedUsers
  );

  return (
    <ContainerWithSideBar
      sidebar={<ProfileSidebar />}
      sidebarHeader={
        <div className="flex items-center gap-2 p-3 text-lg font-semibold">
          <Stars className="size-5" />
          {t('sidebarTitle')}
        </div>
      }
    >
      <NavBar title={t('title')} icon={<ShieldX className="size-5" />} />

      <div className="p-4">
        <p className="text-muted-foreground mb-4 text-sm">{t('description')}</p>
        <div className="bg-muted text-muted-foreground mb-4 rounded-md p-3 text-sm">
          {t('publicContentNotice')}
        </div>

        {isLoading ? (
          <LoadingPlaceholder className="py-16" size={6} />
        ) : error ? (
          <PageRequestError error={error} onRetry={() => void mutate()} />
        ) : !data?.length ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center">
            {t('empty')}
          </div>
        ) : (
          <div className="grid gap-3">
            {data.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-4"
              >
                <Link to={`/${user.username}`} className="flex min-w-0 items-center gap-3">
                  <UserAvatar avatar={user.avatar || undefined} className="size-11 shrink-0" />
                  <div className="min-w-0">
                    <div className="inline-flex max-w-full items-center gap-1 font-semibold">
                      <span className="truncate">{user.nickname || user.username}</span>
                      {user.certified && <VerifiedIcon className="text-theme size-4 shrink-0" />}
                    </div>
                    <div className="text-muted-foreground truncate text-sm">@{user.username}</div>
                  </div>
                </Link>
                <BlockUserButton
                  blocked
                  targetDisplayName={user.nickname || user.username}
                  targetUserId={user.id}
                  onChanged={async (blocked) => {
                    if (!blocked) {
                      await mutate((current) => current?.filter((item) => item.id !== user.id), {
                        revalidate: false,
                      });
                    }
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </ContainerWithSideBar>
  );
}
