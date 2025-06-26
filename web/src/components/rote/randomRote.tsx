import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import RoteItem from '@/components/rote/roteItem';
import { type Profile, type Rote } from '@/types/main';
import { get } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { Dice4, Globe2Icon, RefreshCcwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function RandomRote() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.randomRote',
  });

  const { data: profile } = useAPIGet<Profile>('profile', () =>
    get('/users/me/profile').then((res) => res.data)
  );

  const {
    data: rote,
    isLoading,
    isValidating,
    mutate,
    error,
  } = useAPIGet<Rote>('randomRote', () => get('/notes/random').then((res) => res.data));

  return isLoading ? (
    <LoadingPlaceholder size={6} className="py-8" error={error} />
  ) : rote ? (
    <div className="shrink-0 divide-y">
      <div className="text-md flex items-center gap-2 p-4 font-semibold">
        <Dice4 className="text-primary size-4" />
        {t('title')}
        <RefreshCcwIcon
          className={`ml-auto size-4 cursor-pointer duration-300 hover:opacity-50 ${
            isValidating && 'animate-spin'
          }`}
          onClick={() => mutate()}
        />
      </div>
      {rote.authorid !== profile?.id && (
        <div className="flex min-w-0 items-center gap-2 p-4 text-sm font-light">
          <Globe2Icon className="h-4 w-4 shrink-0" />
          <div className="truncate">此笔记为用户公开笔记。</div>
        </div>
      )}
      <RoteItem rote={rote} showAvatar={false} mutateSingle={mutate} />
    </div>
  ) : null;
}
