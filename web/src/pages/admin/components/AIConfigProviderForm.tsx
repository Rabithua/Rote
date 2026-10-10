import { useState } from 'react';
import { formatEmbeddingError } from './embeddingErrors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { post } from '@/utils/api';
import { Brain, Copy, Database, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { AiProviderConfig, AiProviderPreset, SystemConfig, EmbeddingOutput } from '../types';

type AiConfig = NonNullable<SystemConfig['ai']>;
type ProviderTarget = 'chat' | 'embedding';
type ProviderPatch = Partial<AiProviderConfig & { output: EmbeddingOutput }>;

const LOCAL_LLAMA_COMMAND =
  'llama-server --hf-repo google/gemma-4-12B-it-qat-q4_0-gguf:Q4_0 --host 127.0.0.1 --port 8080 --alias gemma-4-12b-it';

interface AIConfigProviderFormProps {
  target: ProviderTarget;
  config: AiConfig;
  providers: AiProviderPreset[];
  busyAction: string | null;
  updateProvider: (target: ProviderTarget, next: ProviderPatch) => void;
  applyPreset: (target: ProviderTarget, providerId: string) => void;
}

export default function AIConfigProviderForm({
  target,
  config,
  providers,
  busyAction,
  updateProvider,
  applyPreset,
}: AIConfigProviderFormProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const provider = target === 'chat' ? config.chat : config.embedding;
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ signature: string; dimensions: number } | null>(
    null
  );
  const signature = JSON.stringify(provider);
  const detectedDimensions = testResult?.signature === signature ? testResult.dimensions : null;
  const testProvider = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await post('/ai/test', { target, config });
      if (target === 'embedding') setTestResult({ signature, dimensions: res.data.dimensions });
      toast.success(t('ai.testSuccess'));
    } catch (error) {
      toast.error(
        formatEmbeddingError(error, t) || (error instanceof Error ? error.message : t('saveError'))
      );
    } finally {
      setTesting(false);
    }
  };
  const capability = target === 'chat' ? 'chat' : 'embedding';
  const availableProviders = providers.filter((item) => item.capabilities.includes(capability));
  const showLlamaCppTip = target === 'chat' && provider?.providerId === 'llama-cpp';

  const copyLocalCommand = async () => {
    try {
      await navigator.clipboard.writeText(LOCAL_LLAMA_COMMAND);
      toast.success(t('ai.localGuide.copySuccess'));
    } catch {
      toast.error(t('ai.localGuide.copyFailed'));
    }
  };

  return (
    <section className="rounded-md border p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {target === 'chat' ? <Brain className="size-4" /> : <Database className="size-4" />}
          <h3 className="font-medium">
            {target === 'chat' ? t('ai.chatTitle') : t('ai.embeddingTitle')}
          </h3>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={testing || busyAction !== null}
          onClick={testProvider}
        >
          {testing ? t('ai.testing') : t('ai.test')}
        </Button>
      </div>

      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-2">
            <Label>{t(`ai.${target}Provider`)}</Label>
            <Select
              value={provider?.providerId || 'custom'}
              onValueChange={(value) => applyPreset(target, value)}
            >
              <SelectTrigger className="w-full min-w-0 [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableProviders.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-2">
            <Label>{t('ai.model')}</Label>
            <Input
              className="min-w-0"
              value={provider?.model || ''}
              onChange={(event) => updateProvider(target, { model: event.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t('ai.baseUrl')}</Label>
          <Input
            value={provider?.baseUrl || ''}
            onChange={(event) => updateProvider(target, { baseUrl: event.target.value })}
          />
        </div>
        {showLlamaCppTip && (
          <div className="bg-muted/20 rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Terminal className="size-4" />
              {t('ai.localGuide.title')}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">{t('ai.localGuide.description')}</p>
            <div className="mt-3 flex min-w-0 items-center gap-2">
              <code className="bg-background min-w-0 flex-1 overflow-x-auto rounded-md border px-3 py-2 text-xs">
                {LOCAL_LLAMA_COMMAND}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyLocalCommand}
                aria-label={t('ai.localGuide.copy')}
                title={t('ai.localGuide.copy')}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('ai.apiKey')}</Label>
            <Input
              type="password"
              value={provider?.apiKey || ''}
              onChange={(event) => updateProvider(target, { apiKey: event.target.value })}
            />
          </div>
          {target === 'embedding' && (
            <div className="space-y-2">
              <Label htmlFor="embedding-output-mode">{t('ai.outputMode')}</Label>
              <Select
                value={config.embedding?.output.mode || 'native'}
                onValueChange={(mode) =>
                  updateProvider('embedding', {
                    output:
                      mode === 'native'
                        ? { mode: 'native' }
                        : { mode: 'dimensions', dimensions: detectedDimensions || 0 },
                  })
                }
              >
                <SelectTrigger id="embedding-output-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="native">{t('ai.nativeDimensions')}</SelectItem>
                  <SelectItem value="dimensions">{t('ai.requestedDimensions')}</SelectItem>
                </SelectContent>
              </Select>
              {config.embedding?.output.mode === 'dimensions' && (
                <>
                  <Label htmlFor="embedding-dimensions">{t('ai.dimensions')}</Label>
                  <Input
                    id="embedding-dimensions"
                    type="number"
                    min="1"
                    max="2000"
                    step="1"
                    value={config.embedding.output.dimensions || ''}
                    onChange={(event) =>
                      updateProvider('embedding', {
                        output: { mode: 'dimensions', dimensions: Number(event.target.value) },
                      })
                    }
                  />
                </>
              )}
              <p className="text-muted-foreground text-xs" role="status">
                {detectedDimensions
                  ? t('ai.detectedDimensions', { dimensions: detectedDimensions })
                  : t('ai.dimensionTestRequired')}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
