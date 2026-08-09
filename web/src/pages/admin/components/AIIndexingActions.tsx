import { Button } from '@/components/ui/button';
import { post } from '@/utils/api';
import { Database, LoaderCircle, Pause, Play, RefreshCw, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { EmbeddingJobStats, VectorStatus } from './AIIndexingStatus';

interface AIIndexingActionsProps {
  batchSize: number;
  busyAction: string | null;
  jobStats?: EmbeddingJobStats;
  paused: boolean;
  runAction: (key: string, action: () => Promise<any>, success: string) => Promise<void>;
  vectorStatus?: VectorStatus;
}

function ActionIcon({ active, children }: { active: boolean; children: ReactNode }) {
  return active ? <LoaderCircle className="size-4 animate-spin" /> : children;
}

export default function AIIndexingActions({
  batchSize,
  busyAction,
  jobStats,
  paused,
  runAction,
  vectorStatus,
}: AIIndexingActionsProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.ai' });
  const isBusy = busyAction !== null;
  const isVectorReady = Boolean(
    vectorStatus?.available && vectorStatus.installed && vectorStatus.indexName
  );
  const pendingJobs = jobStats?.pending || 0;
  const failedJobs = jobStats?.failed || 0;
  const totalJobs = jobStats
    ? jobStats.pending + jobStats.running + jobStats.succeeded + jobStats.failed
    : 0;
  const processBatchSize = Math.min(pendingJobs, Math.max(batchSize, 1));

  const showSetup = Boolean(vectorStatus?.available && !isVectorReady);
  const showResume = isVectorReady && paused;
  const showRetry = isVectorReady && failedJobs > 0;
  const showProcess = isVectorReady && !paused && pendingJobs > 0;
  const showRecommendedActions = showSetup || showResume || showRetry || showProcess;
  const showMaintenanceActions = isVectorReady || totalJobs > 0;

  if (!showRecommendedActions && !showMaintenanceActions) return null;

  return (
    <div className="space-y-4">
      {showRecommendedActions && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t('recommendedActions')}</h3>
          <div className="flex flex-wrap gap-2">
            {showSetup && (
              <Button
                type="button"
                onClick={() =>
                  runAction('enable-vector', () => post('/ai/vector/enable'), t('pgvectorReady'))
                }
                disabled={isBusy}
              >
                <ActionIcon active={busyAction === 'enable-vector'}>
                  <Database className="size-4" />
                </ActionIcon>
                {t('enablePgvector')}
              </Button>
            )}

            {showResume && (
              <Button
                type="button"
                onClick={() => runAction('resume', () => post('/ai/index/resume'), t('resumed'))}
                disabled={isBusy}
              >
                <ActionIcon active={busyAction === 'resume'}>
                  <Play className="size-4" />
                </ActionIcon>
                {t('resume')}
              </Button>
            )}

            {showRetry && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  runAction('retry', () => post('/ai/index/retry-failed'), t('failedJobsRequeued'))
                }
                disabled={isBusy}
              >
                <ActionIcon active={busyAction === 'retry'}>
                  <RefreshCw className="size-4" />
                </ActionIcon>
                {t('retryFailedCount', { count: failedJobs })}
              </Button>
            )}

            {showProcess && (
              <Button
                type="button"
                onClick={() =>
                  runAction('process', () => post('/ai/index/process'), t('processed'))
                }
                disabled={isBusy}
              >
                <ActionIcon active={busyAction === 'process'}>
                  <Play className="size-4" />
                </ActionIcon>
                {t('processBatch', { count: processBatchSize })}
              </Button>
            )}
          </div>
        </section>
      )}

      {showMaintenanceActions && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t('maintenanceActions')}</h3>
          <div className="flex flex-wrap gap-2">
            {isVectorReady && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  runAction('backfill', () => post('/ai/index/backfill'), t('backfillQueued'))
                }
                disabled={isBusy}
              >
                <ActionIcon active={busyAction === 'backfill'}>
                  <RefreshCw className="size-4" />
                </ActionIcon>
                {t('backfill')}
              </Button>
            )}

            {isVectorReady && !paused && (
              <Button
                type="button"
                variant="outline"
                onClick={() => runAction('pause', () => post('/ai/index/pause'), t('paused'))}
                disabled={isBusy}
              >
                <ActionIcon active={busyAction === 'pause'}>
                  <Pause className="size-4" />
                </ActionIcon>
                {t('pause')}
              </Button>
            )}

            {totalJobs > 0 && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => runAction('clear', () => post('/ai/index/clear'), t('indexCleared'))}
                disabled={isBusy}
              >
                <ActionIcon active={busyAction === 'clear'}>
                  <Trash2 className="size-4" />
                </ActionIcon>
                {t('clearIndex')}
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
