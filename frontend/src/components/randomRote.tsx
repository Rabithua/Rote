import { apiGetRandomRote } from '@/api/rote/main';
import { type Rote } from '@/types/main';
import { RefreshCcwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LoadingPlaceholder from './LoadingPlaceholder';
import RoteItem from './roteItem';
import { useAPIGet } from '@/utils/fetcher';

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
  } = useAPIGet<Rote>('randomRote', apiGetRandomRote);

  return isLoading ? (
    <LoadingPlaceholder size={6} className="py-8" error={error} />
  ) : rote ? (
    <div className="shrink-0 p-4">
      <div className="text-md flex gap-2 py-2 font-semibold">
        {t('title')}
        <RefreshCcwIcon
          className={`ml-auto size-4 cursor-pointer duration-300 hover:opacity-50 ${
            isValidating && 'animate-spin'
          }`}
          onClick={() => mutate()}
        />
      </div>
      <RoteItem rote={rote} randomRoteStyle />
    </div>
  ) : null;
}
