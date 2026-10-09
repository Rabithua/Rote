import type { AiMemoryMessage } from '@/state/aiChat';
import AiStreamingMarkdown from '@/components/ai/AiStreamingMarkdown';
import { AiStatusTitle } from '@/components/ai/AiMessageStatus';
import { Workflow } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function AgentOutputTrace({ message }: { message: AiMemoryMessage }) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.aiMemory' });
  const outputs = message.outputs?.filter(
    (output) => output.kind === 'process' && output.text.trim()
  );
  if (!outputs?.length) return null;

  return (
    <div className="flex flex-col gap-2">
      {outputs.map((output) => (
        <div
          key={output.outputId}
          className="text-muted-foreground flex min-w-0 flex-col gap-1 text-xs"
        >
          <AiStatusTitle icon={<Workflow className="size-3 shrink-0" />}>
            {t(`timeline.phases.${output.phase}`)}
          </AiStatusTitle>
          <AiStreamingMarkdown
            content={output.text}
            isStreaming={false}
            sources={message.sources}
          />
        </div>
      ))}
    </div>
  );
}
