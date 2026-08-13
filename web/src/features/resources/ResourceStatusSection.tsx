import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, HardDrive, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatBytes, storageProgress } from './format';
import type { ResourceState } from './types';
import { isOfficialApiOrigin } from './useResourceState';

interface ResourceStatusSectionProps {
  state?: ResourceState;
  isLoading: boolean;
  error?: unknown;
  onRetry: () => void;
  trustedOfficialPreview?: boolean;
}

export default function ResourceStatusSection({
  state,
  isLoading,
  error,
  onRetry,
  trustedOfficialPreview = false,
}: ResourceStatusSectionProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile.resources' });

  if (isLoading) {
    return <LoadingPlaceholder className="py-10" size={6} />;
  }

  if (error || !state) {
    return (
      <section className="flex items-center gap-3 p-4">
        <AlertTriangle className="text-destructive size-5 shrink-0" />
        <p className="text-muted-foreground min-w-0 flex-1 text-sm">{t('loadFailed')}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" />
          {t('retry')}
        </Button>
      </section>
    );
  }

  const officialTrusted =
    state.management !== 'official' || isOfficialApiOrigin() || trustedOfficialPreview;
  if (!officialTrusted) return null;

  const used = formatBytes(state.storage.usedBytes);
  const reserved = formatBytes(state.storage.reservedBytes);
  const limit = formatBytes(state.storage.limitBytes);
  const progress = storageProgress(
    state.storage.usedBytes,
    state.storage.reservedBytes,
    state.storage.limitBytes
  );
  const storageStatusKey =
    state.storage.enforcement === 'observe'
      ? 'observing'
      : state.storage.canUpload
        ? 'available'
        : 'full';
  return (
    <section>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <HardDrive className="size-4" />
            {t('storage.title')}
          </div>
          <Badge variant="outline">{t(`storage.status.${storageStatusKey}`)}</Badge>
        </div>
        {state.storage.enforcement === 'off' || used === null ? (
          <p className="text-muted-foreground text-sm">{t('storage.notMeasured')}</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-2xl font-semibold">{used}</span>
              <span className="text-muted-foreground text-sm">
                {limit ? t('storage.ofLimit', { limit }) : t('storage.noLimit')}
              </span>
            </div>
            {state.storage.limitBytes ? <Progress value={progress} /> : null}
            <p className="text-muted-foreground text-xs">
              {t('storage.uploading', { reserved: reserved ?? '0 B' })}
            </p>
            {!state.storage.canUpload ? (
              <p className="text-muted-foreground text-sm">{t('storage.fullDescription')}</p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
