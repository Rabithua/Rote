import OpenKeyItem from '@/components/openKey/openKey';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import { Button } from '@/components/ui/button';
import type { OpenKey, OpenKeys } from '@/types/main';
import { KeyRoundIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { KeyedMutator } from 'swr';

interface OpenKeySectionProps {
  openKeys: OpenKeys | undefined;
  isLoading: boolean;
  onCreateOpenKey: () => void;
  onMutate: KeyedMutator<OpenKeys>;
}

export default function OpenKeySection({
  openKeys,
  isLoading,
  onCreateOpenKey,
  onMutate,
}: OpenKeySectionProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });

  return (
    <div className="flex flex-col divide-y">
      <div className="p-4 text-2xl font-semibold">
        OpenKey <br />
        <div className="text-info mt-2 text-sm font-normal">{t('openKeyDescription')}</div>
      </div>
      <div className="flex flex-col divide-y">
        {isLoading ? (
          <LoadingPlaceholder className="py-8" size={6} />
        ) : (
          <>
            {openKeys?.map((openKey: OpenKey) => (
              <OpenKeyItem key={openKey.id} openKey={openKey} mutate={onMutate} />
            ))}
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              {openKeys?.length === 0 && <KeyRoundIcon className="text-info size-8" />}
              <Button variant="secondary" onClick={onCreateOpenKey} className="cursor-pointer p-4">
                {openKeys?.length === 0 ? t('noOpenKey') : t('addOpenKey')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
