import type { AiMemoryMessage } from '@/state/aiChat';
import AiStreamingMarkdown from '@/components/ai/AiStreamingMarkdown';
import { AiStatusTitle, ThinkingTraceEntry } from '@/components/ai/AiMessageStatus';
import { Workflow } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

function OutputRound({
  message,
  output,
  isStreaming,
}: {
  message: AiMemoryMessage;
  output: NonNullable<AiMemoryMessage['outputs']>[number];
  isStreaming: boolean;
}) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.aiMemory' });
  const [expanded, setExpanded] = useState(false);
  const title = output.statusText || t(`timeline.phases.${output.phase}`);
  const content = output.kind === 'answer' ? message.content : output.text;

  return (
    <div className="flex min-w-0 flex-col gap-1" data-output-id={output.outputId}>
      {output.thinking?.trim() ? (
        <ThinkingTraceEntry
          phase={output.thinkingPhase || 'answer'}
          truncateTitle
          id={`thinking-trace-${message.id}-${output.outputId}`}
          title={title}
          text={output.thinking}
          isExpanded={expanded}
          isStreaming={isStreaming}
          onToggle={() => setExpanded((previous) => !previous)}
        />
      ) : (
        <div className={`text-xs leading-5 ${isStreaming ? 'animate-pulse' : ''}`}>
          <AiStatusTitle truncate icon={<Workflow className="size-3 shrink-0" />}>
            {title}
          </AiStatusTitle>
        </div>
      )}
      {content && (
        <AiStreamingMarkdown
          content={content}
          isStreaming={isStreaming}
          sources={message.sources}
        />
      )}
    </div>
  );
}

export function AgentOutputTrace({ message }: { message: AiMemoryMessage }) {
  if (!message.outputs?.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {message.outputs.map((output, index, outputs) => (
        <OutputRound
          key={output.outputId}
          message={message}
          output={output}
          isStreaming={!!message.isStreaming && index === outputs.length - 1}
        />
      ))}
    </div>
  );
}
