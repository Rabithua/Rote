import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import RoteItem from '@/components/rote/roteItem';
import { type Rote } from '@/types/main';
import { get } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { Dice4, RefreshCcwIcon } from 'lucide-react';
import { useTranslation } from 'node_modules/react-i18next';

export default function RandomRote() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.randomRote',
  });

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
      <RoteItem rote={rote} showAvatar={false} mutateSingle={mutate} />
    </div>
  ) : null;
}
