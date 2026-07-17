import Divider from '@/components/ui/divider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SystemConfig } from '../types';
import AIIndexingActions from './AIIndexingActions';
import AIIndexingStatus, { type EmbeddingJobStats, type VectorStatus } from './AIIndexingStatus';

type AiConfig = NonNullable<SystemConfig['ai']>;

interface AIConfigAdvancedSettingsProps {
  config: AiConfig;
  vectorStatus?: VectorStatus;
  jobStats?: EmbeddingJobStats;
  busyAction: string | null;
  updateConfig: (next: Partial<AiConfig>) => void;
  runAction: (key: string, action: () => Promise<any>, success: string) => Promise<void>;
}

export default function AIConfigAdvancedSettings({
  config,
  vectorStatus,
  jobStats,
  busyAction,
  updateConfig,
  runAction,
}: AIConfigAdvancedSettingsProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });

  return (
    <details className="group rounded-md border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4" />
          <span className="font-medium">{t('ai.advancedSettings')}</span>
        </div>
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <Divider />
      <div className="space-y-5 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-2">
            <Label>{t('ai.chunkSize')}</Label>
            <Input
              type="number"
              min="500"
              value={config.indexing?.chunkSize || 1800}
              onChange={(event) =>
                updateConfig({
                  indexing: {
                    ...config.indexing,
                    chunkSize: Number(event.target.value) || 1800,
                  },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t('ai.chunkOverlap')}</Label>
            <Input
              type="number"
              min="0"
              value={config.indexing?.chunkOverlap || 200}
              onChange={(event) =>
                updateConfig({
                  indexing: {
                    ...config.indexing,
                    chunkOverlap: Number(event.target.value) || 0,
                  },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t('ai.batchSize')}</Label>
            <Input
              type="number"
              min="1"
              max="20"
              value={config.indexing?.batchSize || 5}
              onChange={(event) =>
                updateConfig({
                  indexing: {
                    ...config.indexing,
                    batchSize: Number(event.target.value) || 5,
                  },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t('ai.maxRetries')}</Label>
            <Input
              type="number"
              min="1"
              value={config.indexing?.maxRetries || 3}
              onChange={(event) =>
                updateConfig({
                  indexing: {
                    ...config.indexing,
                    maxRetries: Number(event.target.value) || 3,
                  },
                })
              }
            />
          </div>
        </div>

        <AIIndexingStatus
          paused={Boolean(config.indexing?.paused)}
          vectorStatus={vectorStatus}
          jobStats={jobStats}
        />

        <AIIndexingActions
          batchSize={config.indexing?.batchSize || 5}
          busyAction={busyAction}
          jobStats={jobStats}
          paused={Boolean(config.indexing?.paused)}
          runAction={runAction}
          vectorStatus={vectorStatus}
        />
      </div>
    </details>
  );
}
