import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Database,
  LoaderCircle,
  PauseCircle,
  XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface VectorStatus {
  available: boolean;
  installed: boolean;
  version: string | null;
  indexName: string | null;
  dimensions: number;
}

export interface EmbeddingJobStats {
  pending: number;
  running: number;
  succeeded: number;
  failed: number;
}

interface AIIndexingStatusProps {
  paused: boolean;
  vectorStatus?: VectorStatus;
  jobStats?: EmbeddingJobStats;
}

type StatusTone = 'danger' | 'info' | 'neutral' | 'success' | 'warning';

const statusToneClasses: Record<StatusTone, string> = {
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
};

const statusDotClasses: Record<StatusTone, string> = {
  danger: 'bg-destructive',
  info: 'bg-blue-500',
  neutral: 'bg-muted-foreground',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
};

function StatusBadge({ children, tone }: { children: ReactNode; tone: StatusTone }) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-medium ${statusToneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

function ReadinessRow({ label, ready }: { label: string; ready: boolean }) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.ai.indexingStatus' });

  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        {ready ? (
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <XCircle className="text-muted-foreground size-4 shrink-0" />
        )}
        <span>{label}</span>
      </div>
      <span className="text-muted-foreground shrink-0 text-xs">{ready ? t('yes') : t('no')}</span>
    </div>
  );
}

function QueueMetric({ label, tone, value }: { label: string; tone: StatusTone; value: number }) {
  return (
    <div className="bg-background rounded-md border px-3 py-2">
      <div className="flex items-center gap-2">
        <span className={`size-1.5 rounded-full ${statusDotClasses[tone]}`} aria-hidden="true" />
        <span className="text-muted-foreground text-xs">{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function AIIndexingStatus({
  paused,
  vectorStatus,
  jobStats,
}: AIIndexingStatusProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.ai.indexingStatus' });
  const isVectorReady = Boolean(
    vectorStatus?.available && vectorStatus.installed && vectorStatus.indexName
  );
  const stats = {
    pending: jobStats?.pending || 0,
    running: jobStats?.running || 0,
    succeeded: jobStats?.succeeded || 0,
    failed: jobStats?.failed || 0,
  };

  let vectorSummary = {
    description: t('checkingDescription'),
    label: t('checking'),
    tone: 'neutral' as StatusTone,
  };
  if (vectorStatus && !vectorStatus.available) {
    vectorSummary = {
      description: t('vectorUnavailableDescription'),
      label: t('vectorUnavailable'),
      tone: 'danger',
    };
  } else if (vectorStatus && isVectorReady) {
    vectorSummary = {
      description: t('vectorReadyDescription'),
      label: t('vectorReady'),
      tone: 'success',
    };
  } else if (vectorStatus) {
    vectorSummary = {
      description: t('vectorNeedsSetupDescription'),
      label: t('vectorNeedsSetup'),
      tone: 'warning',
    };
  }

  let queueSummary = {
    description: t('checkingDescription'),
    icon: <CircleDashed className="size-5" />,
    label: t('checking'),
    tone: 'neutral' as StatusTone,
  };
  if (jobStats && paused) {
    queueSummary = {
      description: t('queuePausedDescription', {
        failed: stats.failed,
        pending: stats.pending,
      }),
      icon: <PauseCircle className="size-5" />,
      label: t('queuePaused'),
      tone: 'warning',
    };
  } else if (jobStats && stats.failed > 0) {
    queueSummary = {
      description: t('queueNeedsAttentionDescription', { count: stats.failed }),
      icon: <AlertCircle className="size-5" />,
      label: t('queueNeedsAttention'),
      tone: 'danger',
    };
  } else if (jobStats && stats.running > 0) {
    queueSummary = {
      description: t('queueProcessingDescription', { count: stats.running }),
      icon: <LoaderCircle className="size-5 animate-spin" />,
      label: t('queueProcessing'),
      tone: 'info',
    };
  } else if (jobStats && stats.pending > 0) {
    queueSummary = {
      description: t('queueWaitingDescription', { count: stats.pending }),
      icon: <Clock3 className="size-5" />,
      label: t('queueWaiting'),
      tone: 'warning',
    };
  } else if (jobStats) {
    queueSummary = {
      description: t('queueIdleDescription'),
      icon: <CheckCircle2 className="size-5" />,
      label: t('queueIdle'),
      tone: 'success',
    };
  }

  return (
    <section className="grid gap-3 lg:grid-cols-2" aria-live="polite">
      <div className="bg-muted/10 rounded-md border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="bg-background flex size-9 shrink-0 items-center justify-center rounded-md border">
              <Database className="size-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-medium">{t('vectorService')}</h3>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {vectorSummary.description}
              </p>
            </div>
          </div>
          <StatusBadge tone={vectorSummary.tone}>{vectorSummary.label}</StatusBadge>
        </div>

        {vectorStatus ? (
          <div className="mt-4 divide-y rounded-md border px-3 py-2">
            <ReadinessRow label={t('extensionAvailable')} ready={vectorStatus.available} />
            <ReadinessRow label={t('extensionInstalled')} ready={vectorStatus.installed} />
            <ReadinessRow label={t('vectorIndex')} ready={Boolean(vectorStatus.indexName)} />
          </div>
        ) : (
          <div className="bg-background text-muted-foreground mt-4 flex items-center gap-2 rounded-md border px-3 py-4 text-xs">
            <LoaderCircle className="size-4 animate-spin" />
            {t('checking')}
          </div>
        )}

        {vectorStatus && (
          <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {vectorStatus.version && <span>{t('version', { version: vectorStatus.version })}</span>}
            <span>{t('dimensions', { dimensions: vectorStatus.dimensions })}</span>
          </div>
        )}
        {vectorStatus?.indexName && (
          <div className="mt-3 min-w-0">
            <p className="text-muted-foreground text-xs">{t('indexName')}</p>
            <code className="bg-background mt-1 block overflow-x-auto rounded-md border px-2.5 py-2 text-xs">
              {vectorStatus.indexName}
            </code>
          </div>
        )}
      </div>

      <div className="bg-muted/10 rounded-md border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="bg-background flex size-9 shrink-0 items-center justify-center rounded-md border">
              {queueSummary.icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-medium">{t('queue')}</h3>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {queueSummary.description}
              </p>
            </div>
          </div>
          <StatusBadge tone={queueSummary.tone}>{queueSummary.label}</StatusBadge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <QueueMetric label={t('pending')} value={stats.pending} tone="warning" />
          <QueueMetric label={t('running')} value={stats.running} tone="info" />
          <QueueMetric label={t('succeeded')} value={stats.succeeded} tone="success" />
          <QueueMetric label={t('failed')} value={stats.failed} tone="danger" />
        </div>
      </div>
    </section>
  );
}
