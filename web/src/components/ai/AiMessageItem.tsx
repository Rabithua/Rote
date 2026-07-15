import {
  AgentTimeline,
  AiStatusTitle,
  PlannerDebugSummary,
  ScopeSummary,
  ThinkingTrace,
} from '@/components/ai/AiMessageStatus';
import { cleanSourceText, getAiSourcePath } from '@/components/ai/AiSourceList';
import AiStreamingMarkdown from '@/components/ai/AiStreamingMarkdown';
import { useAiAnswerExport } from '@/hooks/useAiAnswerExport';
import { useProfile } from '@/state/profile';
import type { AiMemoryMessage } from '@/state/aiChat';
import { Copy, ImageDown, Printer, Link as LinkIcon, Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

function formatTokenBreakdown(message: AiMemoryMessage) {
  const usageByPhase = message.metrics?.usageByPhase;
  if (!usageByPhase) return '';

  return [
    usageByPhase.planning ? `Plan ${usageByPhase.planning.total_tokens}` : '',
    usageByPhase.tool_decision ? `Tool ${usageByPhase.tool_decision.total_tokens}` : '',
    usageByPhase.answer ? `Answer ${usageByPhase.answer.total_tokens}` : '',
  ]
    .filter(Boolean)
    .join(' / ');
}

export function AiMessageItem({ message }: { message: AiMemoryMessage }) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.aiMemory' });
  const profile = useProfile();
  const { exporting, handleExportImage, handleExportPdf } = useAiAnswerExport();
  const hasThinking = Object.values(message.thinking || {}).some((text) => text?.trim());
  const hasAssistantStatus =
    message.role === 'assistant' && ((message.timeline?.length || 0) > 0 || hasThinking);
  const tokenBreakdown = formatTokenBreakdown(message);
  const copyAnswer = async () => {
    const sourceLines = (message.sources || [])
      .map((source, index) => `[${index + 1}] ${window.location.origin}${getAiSourcePath(source)}`)
      .join('\n');
    const text = sourceLines
      ? `${message.content}\n\n---\n${t('savedSourceTitle')}\n${sourceLines}`
      : message.content;

    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('actions.copySuccess'));
    } catch {
      toast.error(t('actions.copyFailed'));
    }
  };

  return (
    <div className={`px-4 py-4 ${message.role === 'assistant' ? 'bg-foreground/2' : ''}`}>
      <div className="mx-auto flex max-w-3xl flex-col gap-2 text-sm">
        {message.role === 'assistant' && (
          <AgentTimeline message={message} title={t('timeline.title')} />
        )}
        {message.role === 'assistant' && (
          <ScopeSummary message={message} title={t('scope.title')} />
        )}
        {message.role === 'assistant' && (
          <PlannerDebugSummary message={message} title={t('debug.title')} />
        )}
        {message.role === 'assistant' && <ThinkingTrace message={message} />}
        {message.role === 'assistant' && (message.sources?.length || 0) > 0 && (
          <div className="relative flex w-full items-center gap-1.5 text-xs">
            <AiStatusTitle icon={<LinkIcon className="size-3 shrink-0" />}>
              {t('sources.inlineTitle')}:
            </AiStatusTitle>
            <div
              className="noScrollBar flex flex-1 items-center gap-1.5 overflow-x-auto"
              style={{
                WebkitMaskImage:
                  'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
                maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
                paddingRight: '24px',
              }}
            >
              {message.sources?.map((source, index) => {
                const cleanText = source.preview || cleanSourceText(source.text || '');
                const titleText =
                  source.metadata?.title ||
                  cleanText.slice(0, 30).replace(/\s+/g, ' ').trim() ||
                  `[${index + 1}]`;
                const path = getAiSourcePath(source);
                return (
                  <Link
                    key={`${source.sourceType}-${source.sourceId}`}
                    to={path}
                    title={titleText}
                    className="hover:bg-foreground/5 hover:text-foreground inline-flex shrink-0 items-center gap-1 font-mono text-xs underline transition-colors"
                  >
                    <span>[{index + 1}]</span>
                    <span className="max-w-[120px] truncate">{titleText}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        {message.role === 'assistant' && (!message.error || message.errorDetail) ? (
          message.content ? (
            <AiStreamingMarkdown
              content={message.content}
              isStreaming={message.isStreaming}
              sources={message.sources}
            />
          ) : (
            !message.error &&
            !hasAssistantStatus && (
              <div className="text-info flex items-center gap-2">
                <Loader className="size-4 animate-spin" />
                {!message.plan
                  ? t('messages.thinking')
                  : !(message.sources && message.sources.length > 0)
                    ? t('messages.searching')
                    : t('messages.reading')}
              </div>
            )
          )
        ) : (
          <div
            className={`wrap-break-word whitespace-pre-line ${
              message.error ? 'text-destructive' : ''
            }`}
          >
            {message.content}
          </div>
        )}
        {message.error && message.errorDetail && (
          <div className="text-destructive text-xs wrap-break-word whitespace-pre-line">
            {message.errorDetail}
          </div>
        )}
        {!message.error && message.metrics && !message.isStreaming && (
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 font-mono text-[10px]">
            {message.metrics.planTime && (
              <span>Plan: {(message.metrics.planTime / 1000).toFixed(2)}s</span>
            )}
            {message.metrics.sourcesTime && (
              <span>
                Sources:{' '}
                {((message.metrics.sourcesTime - (message.metrics.planTime || 0)) / 1000).toFixed(
                  2
                )}
                s
              </span>
            )}
            {message.metrics.firstTokenTime && (
              <span>
                First Token:{' '}
                {(
                  (message.metrics.firstTokenTime -
                    (message.metrics.sourcesTime || message.metrics.planTime || 0)) /
                  1000
                ).toFixed(2)}
                s
              </span>
            )}
            {message.metrics.totalTime && (
              <span>Total: {(message.metrics.totalTime / 1000).toFixed(2)}s</span>
            )}
            {message.metrics.usage && (
              <span>
                Tokens: {message.metrics.usage.total_tokens}
                {tokenBreakdown ? ` (${tokenBreakdown})` : ''}
              </span>
            )}
          </div>
        )}
        {message.role === 'assistant' && !message.isStreaming && !message.error && (
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px]">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 p-0 text-[11px] font-normal disabled:pointer-events-none disabled:opacity-50"
              disabled={!message.content}
              onClick={() => void copyAnswer()}
              aria-label={t('actions.copy')}
              title={t('actions.copy')}
            >
              <Copy className="size-3" />
              {t('actions.copy')}
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 p-0 text-[11px] font-normal disabled:pointer-events-none disabled:opacity-50"
              disabled={!message.content || exporting}
              onClick={() =>
                void handleExportImage({
                  content: message.content,
                  sources: message.sources,
                  sourceTitle: t('savedSourceTitle'),
                  author: profile,
                })
              }
              aria-label={t('actions.exportImage')}
              title={t('actions.exportImage')}
            >
              {exporting ? (
                <Loader className="size-3 animate-spin" />
              ) : (
                <ImageDown className="size-3" />
              )}
              {exporting ? t('actions.exporting') : t('actions.exportImage')}
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 p-0 text-[11px] font-normal disabled:pointer-events-none disabled:opacity-50"
              disabled={!message.content || exporting}
              onClick={() =>
                void handleExportPdf({
                  content: message.content,
                  sources: message.sources,
                  sourceTitle: t('savedSourceTitle'),
                  author: profile,
                })
              }
              aria-label={t('actions.exportPdf')}
              title={t('actions.exportPdf')}
            >
              {exporting ? (
                <Loader className="size-3 animate-spin" />
              ) : (
                <Printer className="size-3" />
              )}
              {exporting ? t('actions.exporting') : t('actions.exportPdf')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
