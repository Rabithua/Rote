import type { AiMemoryMessage } from '@/state/aiChat';
import type { AiThinkingPhase, PlannerAgentDto } from '@/utils/aiApi';
import { Brain, SlidersHorizontal, Workflow } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function AiStatusTitle({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <span className="text-muted-foreground flex shrink-0 items-center gap-1 font-medium whitespace-nowrap select-none">
      {icon}
      {children}
    </span>
  );
}

function buildScopeSummary(plan: PlannerAgentDto, t: ReturnType<typeof useTranslation>['t']) {
  const summary: string[] = [];
  const scope = plan.scope;
  if (!scope) return summary;
  const listSeparator = t('scope.listSeparator');

  if (scope.timeRange) summary.push(t('scope.time', { label: scope.timeRange.label }));

  if (scope.tags.length) {
    summary.push(t('scope.tags', { tags: scope.tags.map((tag) => `#${tag}`).join(listSeparator) }));
  }

  if (scope.excludeTags.length) {
    summary.push(
      t('scope.excludeTags', {
        tags: scope.excludeTags.map((tag) => `#${tag}`).join(listSeparator),
      })
    );
  }

  if (scope.semanticScope.length) {
    summary.push(t('scope.semanticScope', { keywords: scope.semanticScope.join(listSeparator) }));
  }

  const sourceTypes = scope.sourceTypes;
  if (sourceTypes.length === 1) {
    summary.push(
      sourceTypes[0] === 'rote' ? t('scope.sourceTypes.rote') : t('scope.sourceTypes.article')
    );
  } else {
    summary.push(t('scope.sourceTypes.all'));
  }

  if (scope.lifecycleScope === 'archived') {
    summary.push(t('scope.archive.archived'));
  } else if (scope.lifecycleScope === 'active') {
    summary.push(t('scope.archive.active'));
  } else if (scope.lifecycleScope === 'all') {
    summary.push(t('scope.archive.all'));
  }

  if (scope.taskStatusScope !== 'unspecified') {
    summary.push(t(`scope.taskStatus.${scope.taskStatusScope}`));
  }

  return summary;
}

function buildDebugSummary(plan: PlannerAgentDto, t: ReturnType<typeof useTranslation>['t']) {
  const trace = plan.debugTrace;
  const summary: string[] = [];

  if (trace.toolCalls.length > 0) {
    const names = trace.toolCalls.map((call) => call.name).join(' -> ');
    summary.push(t('debug.tools', { count: trace.toolCalls.length, names }));
  }

  if (trace.probeCounts.length > 0) {
    summary.push(t('debug.probes', { counts: trace.probeCounts.join(' / ') }));
  }

  if (trace.finishReason) {
    summary.push(t('debug.finish', { reason: trace.finishReason }));
  }

  if (trace.fallbackReason) {
    summary.push(t('debug.fallback', { reason: trace.fallbackReason }));
  }

  if (trace.providerError) {
    summary.push(t('debug.providerError'));
  }

  if (trace.toolError) {
    summary.push(t('debug.toolError'));
  }

  if (trace.warnings.length > 0) {
    const warnings = trace.warnings
      .slice(0, 3)
      .map((warning) =>
        warning.startsWith('semantic_search_fallback_text')
          ? t('debug.warningLabels.semanticSearchTextFallback')
          : warning
      )
      .join(' / ');
    summary.push(t('debug.warnings', { warnings }));
  }

  return summary;
}

export function ScopeSummary({ message, title }: { message: AiMemoryMessage; title: string }) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.aiMemory' });
  const summary = message.plan ? buildScopeSummary(message.plan, t) : [];

  if (summary.length > 0) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <AiStatusTitle icon={<SlidersHorizontal className="size-3 shrink-0" />}>
          {title}:
        </AiStatusTitle>
        {summary.map((item) => (
          <span key={item} className="text-info bg-foreground/5 rounded px-1.5 py-0.5">
            {item}
          </span>
        ))}
      </div>
    );
  }

  return null;
}

export function PlannerDebugSummary({
  message,
  title,
}: {
  message: AiMemoryMessage;
  title: string;
}) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.aiMemory' });
  const summary = message.plan ? buildDebugSummary(message.plan, t) : [];

  if (summary.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <AiStatusTitle icon={<Workflow className="size-3 shrink-0" />}>{title}:</AiStatusTitle>
      {summary.map((item) => (
        <span key={item} className="text-muted-foreground bg-foreground/5 rounded px-1.5 py-0.5">
          {item}
        </span>
      ))}
    </div>
  );
}

export function AgentTimeline({ message, title }: { message: AiMemoryMessage; title: string }) {
  const items = message.timeline || [];
  if (items.length === 0) return null;

  const runningItems = items.filter((item) => item.status === 'running');
  if (runningItems.length === 0) return null;

  const currentItem = [...runningItems].sort(
    (first, second) => second.updatedAt - first.updatedAt
  )[0];

  if (!currentItem) return null;

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs leading-5">
      <AiStatusTitle icon={<Workflow className="size-3 shrink-0" />}>{title}:</AiStatusTitle>
      <span
        className={`text-muted-foreground min-w-0 flex-1 truncate ${
          currentItem.status === 'running' ? 'animate-pulse' : ''
        }`}
      >
        {currentItem.message}
      </span>
    </div>
  );
}

export function ThinkingPendingLine({ title }: { title: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs leading-5">
      <AiStatusTitle icon={<Brain className="size-3 shrink-0 animate-pulse" />}>
        {title}
      </AiStatusTitle>
      <span className="text-muted-foreground animate-pulse">...</span>
    </div>
  );
}

export function ThinkingTraceEntry({
  phase,
  text,
  title,
  isExpanded,
  isStreaming,
  onToggle,
}: {
  phase: AiThinkingPhase;
  text: string;
  title: string;
  isExpanded: boolean;
  isStreaming: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.aiMemory' });
  const lineRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef<HTMLDivElement>(null);
  const inlineText = useMemo(() => text.replace(/\s+/g, ' ').trim(), [text]);
  const traceId = `thinking-trace-${phase}`;
  const ariaExpanded = isExpanded ? 'true' : 'false';

  useEffect(() => {
    if (isExpanded) return;
    const line = lineRef.current;
    if (!line) return;
    line.scrollLeft = line.scrollWidth;
  }, [inlineText, isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;
    const expanded = expandedRef.current;
    if (!expanded) return;
    expanded.scrollTop = expanded.scrollHeight;
  }, [text, isExpanded]);

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1.5 text-xs leading-5">
        <AiStatusTitle
          icon={<Brain className={`size-3 shrink-0 ${isStreaming ? 'animate-pulse' : ''}`} />}
        >
          {title}
          {!isExpanded && t('thinkingTrace.separator')}
        </AiStatusTitle>
        {!isExpanded && (
          <div
            ref={lineRef}
            className="noScrollBar text-muted-foreground min-w-0 flex-1 overflow-x-auto whitespace-nowrap opacity-80"
            style={{
              WebkitMaskImage:
                'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
              maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
              paddingRight: '24px',
            }}
          >
            {inlineText}
          </div>
        )}
        {isExpanded && <div className="min-w-0 flex-1" />}
        <button
          type="button"
          aria-expanded={ariaExpanded}
          aria-controls={traceId}
          className="text-muted-foreground hover:text-foreground shrink-0 whitespace-nowrap opacity-70 transition-colors"
          onClick={onToggle}
        >
          {isExpanded ? t('thinkingTrace.collapse') : t('thinkingTrace.expand')}
        </button>
      </div>
      <div
        id={traceId}
        ref={expandedRef}
        hidden={!isExpanded}
        className="text-muted-foreground mt-1 max-h-36 overflow-y-auto text-xs leading-5 whitespace-pre-wrap"
      >
        {text}
      </div>
    </div>
  );
}

export function ThinkingTrace({ message }: { message: AiMemoryMessage }) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.aiMemory' });
  const [expandedPhases, setExpandedPhases] = useState<Record<AiThinkingPhase, boolean>>({
    route_decision: false,
    evidence_decision: false,
    retrieval_planning: false,
    answer: false,
  });
  const entries = [
    { phase: 'route_decision' as const, text: message.thinking?.route_decision || '' },
    {
      phase: 'retrieval_planning' as const,
      text: message.thinking?.retrieval_planning || '',
    },
    { phase: 'evidence_decision' as const, text: message.thinking?.evidence_decision || '' },
    { phase: 'answer' as const, text: message.thinking?.answer || '' },
  ].filter((entry) => entry.text.trim().length > 0);
  const isStreaming = message.isStreaming || false;

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const title = t(`thinkingTrace.${entry.phase}`);
        const isExpanded = expandedPhases[entry.phase] || false;

        return (
          <ThinkingTraceEntry
            key={entry.phase}
            phase={entry.phase}
            text={entry.text}
            title={title}
            isExpanded={isExpanded}
            isStreaming={isStreaming}
            onToggle={() =>
              setExpandedPhases((current) => ({
                ...current,
                [entry.phase]: !current[entry.phase],
              }))
            }
          />
        );
      })}
    </div>
  );
}
