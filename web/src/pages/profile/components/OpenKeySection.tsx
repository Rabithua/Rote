import OpenKeyItem from '@/components/openKey/openKey';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import { Button } from '@/components/ui/button';
import type { ResourceState } from '@/features/resources/types';
import type { OpenKey, OpenKeys } from '@/types/main';
import { KeyRoundIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { KeyedMutator } from 'swr';

interface OpenKeySectionProps {
  openKeys: OpenKeys | undefined;
  isLoading: boolean;
  onCreateOpenKey: () => void;
  onMutate: KeyedMutator<OpenKeys>;
  canCreate: boolean;
  resourceState?: ResourceState['openKey'];
}

export default function OpenKeySection({
  openKeys,
  isLoading,
  onCreateOpenKey,
  onMutate,
  canCreate,
  resourceState,
}: OpenKeySectionProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });

  return (
    <div className="flex flex-col divide-y">
      <div className="space-y-2 p-4">
        <div className="flex items-baseline justify-between gap-4 text-2xl font-semibold">
          <span>OpenKey</span>
          {resourceState ? (
            <span className="text-muted-foreground text-base font-normal">
              {resourceState.policy === 'unlimited'
                ? t('resources.openKey.countUnlimited', {
                    count: resourceState.existingCount,
                  })
                : t('resources.openKey.countThreshold', {
                    count: resourceState.existingCount,
                    limit: resourceState.creationThreshold ?? 1,
                  })}
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm font-normal">{t('openKeyDescription')}</p>
        {resourceState && !resourceState.canCreate ? (
          <p className="text-muted-foreground text-sm font-normal">
            {t('resources.openKey.noNewTitle')} {t('resources.openKey.noNewDescription')}
          </p>
        ) : null}
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
              <Button
                variant="secondary"
                onClick={onCreateOpenKey}
                disabled={!canCreate}
                className="cursor-pointer p-4"
              >
                {openKeys?.length === 0 ? t('noOpenKey') : t('addOpenKey')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
