import { formatEmbeddingError } from './embeddingErrors';
import AIConfigSaveButton from './AIConfigSaveButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Divider from '@/components/ui/divider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { get, put } from '@/utils/api';
import { Activity } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import useSWR, { useSWRConfig } from 'swr';
import type { AiProviderConfig, AiProviderPreset, SystemConfig } from '../types';
import AIConfigAdvancedSettings from './AIConfigAdvancedSettings';
import AIConfigProviderForm from './AIConfigProviderForm';
import type { EmbeddingJobStats, VectorStatus } from './AIIndexingStatus';

interface AIConfigTabProps {
  aiConfig: SystemConfig['ai'] | undefined;
  setAiConfig: (config: SystemConfig['ai'] | undefined) => void;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  onMutate: () => void;
}

function mergeAiConfig(
  config: SystemConfig['ai'],
  defaults: NonNullable<SystemConfig['ai']>
): NonNullable<SystemConfig['ai']> {
  const chat = { ...defaults.chat, ...(config?.chat || {}) } as AiProviderConfig;
  const embedding = {
    ...defaults.embedding,
    ...(config?.embedding || {}),
  } as NonNullable<SystemConfig['ai']>['embedding'];

  return {
    ...defaults,
    ...(config || {}),
    chat,
    embedding,
    indexing: { ...defaults.indexing, ...(config?.indexing || {}) },
  };
}

function StatusPill({ active, text }: { active: boolean; text: string }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-medium ${
        active
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      {text}
    </span>
  );
}

function MetricBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-muted/20 rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

export default function AIConfigTab(props: AIConfigTabProps) {
  const { t } = useTranslation();
  const { data: defaults } = useSWR(
    '/ai/defaults',
    async () => (await get('/ai/defaults')).data as NonNullable<SystemConfig['ai']>
  );
  if (!defaults && !props.aiConfig) return <p>{t('pages.admin.ai.testing')}</p>;
  return <AIConfigEditor {...props} defaults={defaults || props.aiConfig!} />;
}

function AIConfigEditor({
  defaults,
  aiConfig,
  setAiConfig,
  isSaving,
  setIsSaving,
  onMutate,
}: AIConfigTabProps & { defaults: NonNullable<SystemConfig['ai']> }) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const { mutate: mutateGlobal } = useSWRConfig();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const config = useMemo(() => mergeAiConfig(aiConfig, defaults), [aiConfig, defaults]);

  const { data: savedAi, mutate: mutateSavedAi } = useSWR(
    '/admin/settings?group=ai',
    async () =>
      (await get('/admin/settings?group=ai')).data as { config: NonNullable<SystemConfig['ai']> }
  );
  const hasUnsavedChanges =
    !savedAi || JSON.stringify(config) !== JSON.stringify(mergeAiConfig(savedAi.config, defaults));

  const { data: providers = [] } = useSWR<AiProviderPreset[]>('/ai/providers', async () => {
    const res = await get('/ai/providers');
    return res.data as AiProviderPreset[];
  });
  const { data: vectorStatus, mutate: mutateVectorStatus } = useSWR<VectorStatus>(
    '/ai/vector/status',
    async () => {
      const res = await get('/ai/vector/status');
      return res.data;
    },
    { refreshInterval: 3000 }
  );
  const { data: jobStats, mutate: mutateJobStats } = useSWR<EmbeddingJobStats>(
    '/ai/index/stats',
    async () => {
      const res = await get('/ai/index/stats');
      return res.data;
    },
    { refreshInterval: 3000 }
  );
  const isVectorReady = Boolean(vectorStatus?.ready);

  const updateConfig = (next: Partial<NonNullable<SystemConfig['ai']>>) => {
    setAiConfig(mergeAiConfig({ ...config, ...next }, defaults));
  };

  const updateProvider = (
    target: 'chat' | 'embedding',
    next: Partial<AiProviderConfig & { output: import('../types').EmbeddingOutput }>
  ) => {
    updateConfig({
      [target]: {
        ...(config[target] as any),
        ...next,
      },
    });
  };

  const applyPreset = (target: 'chat' | 'embedding', providerId: string) => {
    const preset = providers.find((item) => item.id === providerId);
    if (!preset) return;
    const model =
      target === 'chat'
        ? preset.chatModels[0] || config.chat?.model || ''
        : preset.embeddingModels[0] || config.embedding?.model || '';
    updateProvider(target, {
      providerId,
      baseUrl: preset.baseUrl,
      model,
      apiKey: '',
      ...(target === 'embedding' ? { output: { mode: 'native' as const } } : {}),
    });
  };

  const handleSave = async (snapshot: NonNullable<SystemConfig['ai']>): Promise<boolean> => {
    setIsSaving(true);
    try {
      const res = await put('/admin/settings', {
        group: 'ai',
        config: snapshot,
      });
      setAiConfig(res.data.config);
      await mutateSavedAi();
      toast.success(t('saveSuccess'));
      await Promise.all([Promise.resolve(onMutate()), mutateGlobal('site-status')]);
      await Promise.all([mutateVectorStatus(), mutateJobStats()]);
      return true;
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        error?.response?.data?.error ||
        'Unknown error';
      toast.error(t('saveFailed', { error: formatEmbeddingError(error, t) || errorMessage }));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const runAction = async (key: string, action: () => Promise<any>, success: string) => {
    setBusyAction(key);
    try {
      await action();
      toast.success(success);
      await Promise.all([
        mutateVectorStatus(),
        mutateSavedAi(),
        mutateJobStats(),
        Promise.resolve(onMutate()),
        mutateGlobal('site-status'),
      ]);
    } catch (error: any) {
      toast.error(
        formatEmbeddingError(error, t) ||
          error?.response?.data?.message ||
          error?.message ||
          t('ai.embeddingErrors.embedding_job_failed')
      );
    } finally {
      setBusyAction(null);
    }
  };

  const renderSwitchRow = (
    key: 'enabled' | 'vectorEnabled' | 'autoIndexEnabled' | 'publicExploreVectorEnabled',
    label: string,
    description: string
  ) => (
    <div className="flex min-h-16 items-center justify-between gap-4 rounded-md border px-4 py-3">
      <div className="min-w-0 space-y-1">
        <Label>{label}</Label>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <Switch
        checked={Boolean(config[key])}
        onCheckedChange={(checked) => updateConfig({ [key]: checked } as any)}
      />
    </div>
  );

  return (
    <Card className="rounded-none border-none shadow-none">
      <CardHeader className="pb-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>{t('ai.title')}</CardTitle>
            <CardDescription>{t('ai.description')}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill
              active={config.enabled === true}
              text={config.enabled ? t('ai.enabledStatus') : t('ai.disabledStatus')}
            />
            <StatusPill
              active={isVectorReady}
              text={
                !vectorStatus
                  ? t('ai.vectorChecking')
                  : isVectorReady
                    ? t('ai.vectorReady')
                    : t('ai.vectorNotReady')
              }
            />
          </div>
        </div>
      </CardHeader>
      <Divider />

      <CardContent className="space-y-6">
        <section className="grid gap-3 md:grid-cols-4">
          <MetricBlock label={t('ai.providerSummary')} value={config.chat?.providerId || '-'} />
          <MetricBlock
            label={t('ai.embeddingSummary')}
            value={config.embedding?.providerId || '-'}
          />
          <MetricBlock label={t('ai.pendingJobs')} value={jobStats?.pending || 0} />
          <MetricBlock label={t('ai.failedJobs')} value={jobStats?.failed || 0} />
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="size-4" />
            <h3 className="font-medium">{t('ai.basicSwitches')}</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {renderSwitchRow('enabled', t('ai.enabled'), t('ai.enabledDesc'))}
            {renderSwitchRow('vectorEnabled', t('ai.vectorEnabled'), t('ai.vectorEnabledDesc'))}
            {renderSwitchRow(
              'autoIndexEnabled',
              t('ai.autoIndexEnabled'),
              t('ai.autoIndexEnabledDesc')
            )}
            {renderSwitchRow(
              'publicExploreVectorEnabled',
              t('ai.publicExploreVectorEnabled'),
              t('ai.publicExploreVectorEnabledDesc')
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-medium">{t('ai.modelProviders')}</h3>
          <div className="grid gap-4 xl:grid-cols-2">
            <AIConfigProviderForm
              target="chat"
              config={config}
              providers={providers}
              busyAction={busyAction}
              updateProvider={updateProvider}
              applyPreset={applyPreset}
            />
            <AIConfigProviderForm
              target="embedding"
              config={config}
              providers={providers}
              busyAction={busyAction}
              updateProvider={updateProvider}
              applyPreset={applyPreset}
            />
          </div>
        </section>

        <AIConfigAdvancedSettings
          config={config}
          vectorFeaturesEnabled={
            savedAi?.config.enabled === true && savedAi.config.vectorEnabled === true
          }
          hasUnsavedChanges={hasUnsavedChanges}
          vectorStatus={vectorStatus}
          jobStats={jobStats}
          busyAction={busyAction}
          updateConfig={updateConfig}
          runAction={runAction}
        />

        <AIConfigSaveButton
          config={config}
          disabled={isSaving || busyAction !== null}
          onSave={handleSave}
        />
      </CardContent>
    </Card>
  );
}
