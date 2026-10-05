import { deliverReadEvidence, deliverSearchEvidence, exhaustedEvidence } from './evidenceDelivery';
import { eq } from 'drizzle-orm';
import { rotes } from '../../../drizzle/schema';
import db from '../../drizzle';
import {
  findArticleById,
  findRoteById,
  searchMemory,
  searchRotesProbe,
  sanitizeExcludeIds,
  toPlannerAgentDto,
  type AiSourceType,
  type SemanticSearchResult,
} from '../../dbMethods';
import {
  canonicalizeSearchRotesArgs,
  getUserRoteTags,
  type LifecycleScope,
  type RetrievalDateField,
  type RetrievalSelection,
  type SearchRotesArgs,
  type TaskStatusScope,
} from '../retrievalPlan';
import { getNativeRoteSkill, NATIVE_ROTE_SKILLS } from './skills';
import {
  FIND_RELATED_NOTES_TOOL_DEFINITION,
  GET_NOTE_TOOL_DEFINITION,
  GET_TAGS_TOOL_DEFINITION,
  createSearchNotesToolDefinition,
  createSkillViewToolDefinition,
} from './toolDefinitions';
import type { RoteAgentContext, RoteAgentTool, RoteAgentToolResult } from './types';

const VALID_SOURCE_TYPES = new Set<AiSourceType>(['rote', 'article']);
const VALID_LIFECYCLE_SCOPES = new Set<LifecycleScope>([
  'active',
  'archived',
  'all',
  'unspecified',
]);
const VALID_TASK_STATUS_SCOPES = new Set<TaskStatusScope>(['open', 'closed', 'all', 'unspecified']);
function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function uniqueStrings(value: unknown, limit = 20): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim().replace(/^#/, '') : ''))
        .filter(Boolean)
    )
  ).slice(0, limit);
}

function normalizeLimit(value: unknown, fallback = 8): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(Math.floor(numeric), 1), 50);
}

function sourceKey(source: SemanticSearchResult): string {
  return `${source.sourceType}:${source.sourceId}`;
}

function toModelContent(value: unknown): string {
  return JSON.stringify(value);
}

function parseSearchNotesInput(args: unknown, fallbackQuery: string): SearchRotesArgs {
  const raw = asRecord(args);
  const tags = asRecord(raw.tags);
  const sourceTypes = uniqueStrings(raw.sourceTypes)
    .filter((type): type is AiSourceType => VALID_SOURCE_TYPES.has(type as AiSourceType))
    .slice(0, 2);
  return {
    query: typeof raw.query === 'string' ? raw.query.trim() : fallbackQuery,
    tags: uniqueStrings(raw.tags).length ? uniqueStrings(raw.tags) : uniqueStrings(tags.include),
    excludeTags: uniqueStrings(raw.excludeTags).length
      ? uniqueStrings(raw.excludeTags)
      : uniqueStrings(tags.exclude),
    semanticScope: uniqueStrings(raw.semanticScope),
    timeRange:
      raw.timeRange && typeof raw.timeRange === 'object' && !Array.isArray(raw.timeRange)
        ? raw.timeRange
        : undefined,
    timeExpression: typeof raw.timeExpression === 'string' ? raw.timeExpression.trim() : undefined,
    from: typeof raw.from === 'string' ? raw.from.trim() : undefined,
    to: typeof raw.to === 'string' ? raw.to.trim() : undefined,
    selection:
      raw.selection === 'relevance' || raw.selection === 'recent'
        ? (raw.selection as RetrievalSelection)
        : undefined,
    dateField:
      raw.dateField === 'createdAt' || raw.dateField === 'updatedAt'
        ? (raw.dateField as RetrievalDateField)
        : undefined,
    lifecycleScope: VALID_LIFECYCLE_SCOPES.has(raw.lifecycleScope as LifecycleScope)
      ? (raw.lifecycleScope as LifecycleScope)
      : VALID_LIFECYCLE_SCOPES.has(raw.archivedScope as LifecycleScope)
        ? (raw.archivedScope as LifecycleScope)
        : undefined,
    taskStatusScope: VALID_TASK_STATUS_SCOPES.has(raw.taskStatusScope)
      ? (raw.taskStatusScope as TaskStatusScope)
      : undefined,
    sourceTypes: sourceTypes.length ? sourceTypes : undefined,
    limit: raw.limit === undefined ? undefined : normalizeLimit(raw.limit),
  };
}

function buildSeenSourceIds(
  ctx: RoteAgentContext,
  sources: SemanticSearchResult[],
  includePrevious = true
): string[] {
  const previousIds = includePrevious ? ctx.state.seenSourceIds || [] : [];
  return Array.from(new Set([...previousIds, ...sources.map((source) => sourceKey(source))])).slice(
    0,
    500
  );
}

async function executeAgentSearch(input: SearchRotesArgs, ctx: RoteAgentContext) {
  const availableTags = await getUserRoteTags(ctx.userId);
  const { scope, warnings } = canonicalizeSearchRotesArgs({
    ownerId: ctx.userId,
    args: input,
    availableTags,
    message: ctx.request.message,
    excludeIds: sanitizeExcludeIds([
      ...(ctx.request.excludeIds || []),
      ...(ctx.state.seenSourceIds || []),
    ]),
    timeContext: ctx.state.clientContext,
  });
  const probe = await searchRotesProbe(scope);
  const toolResult = {
    ...probe.toolResult,
    warnings: Array.from(new Set([...warnings, ...probe.toolResult.warnings])),
  };
  return {
    originalMessage: ctx.request.message,
    retrievalNeeded: true,
    scope,
    toolResult,
    sources: probe.sources,
    clarification: null,
    debugTrace: {
      toolCalls: [{ step: 0, name: 'rote_search_notes', args: input }],
      canonicalizedArgs: [scope],
      warnings: toolResult.warnings,
      probeCounts: [toolResult.resultCount],
      finishReason: 'agent_search_tool',
    },
  };
}

async function executeSearchNotes(
  args: unknown,
  ctx: RoteAgentContext
): Promise<RoteAgentToolResult> {
  if (ctx.sourceBudget.exhausted()) return { ...exhaustedEvidence(ctx), observations: [] };
  const input = parseSearchNotesInput(args, ctx.request.message?.trim() || '');
  await ctx.emit({
    type: 'tool_progress',
    toolName: 'rote_search_notes',
    status: 'determining_scope',
  });
  const plan = await executeAgentSearch(input, ctx);

  await ctx.emit({
    type: 'tool_progress',
    toolName: 'rote_search_notes',
    status: 'retrieving_sources',
  });
  const { ownerId: _owner, cursor: _cursor, excludeIds: _excluded, ...scope } = plan.scope;
  const delivery = deliverSearchEvidence(ctx, plan.sources as SemanticSearchResult[], {
    scope,
    warnings: plan.toolResult.warnings,
  });
  const planDto = toPlannerAgentDto(plan);
  // Probe cursors include undelivered hits; agent continuation uses delivered IDs.
  const statePatch = {
    previousPlan: planDto,
    seenSourceIds: buildSeenSourceIds(ctx, delivery.sources, true),
  };
  return {
    ...delivery,
    observations: [`Found ${plan.sources.length} source(s); delivered ${delivery.sources.length}.`],
    displaySummary: delivery.retrieval,
    plan: planDto,
    statePatch,
  };
}

async function loadOwnedSource(
  ctx: RoteAgentContext,
  sourceType: AiSourceType,
  sourceId: string
): Promise<{ source: SemanticSearchResult; content: string }> {
  if (sourceType === 'rote') {
    const rote = await findRoteById(sourceId);
    if (!rote || rote.authorid !== ctx.userId) {
      throw new Error('Note not found or permission denied');
    }
    const content = rote.content || '';
    return {
      content,
      source: {
        id: `rote:${rote.id}`,
        ownerId: rote.authorid,
        sourceType: 'rote',
        sourceId: rote.id,
        chunkIndex: 0,
        text: content,
        similarity: 1,
        metadata: {
          title: rote.title || '',
          tags: rote.tags || [],
          state: rote.state,
          archived: rote.archived,
          createdAt: rote.createdAt,
          updatedAt: rote.updatedAt,
        },
      },
    };
  }

  const article = await findArticleById(sourceId);
  if (!article || article.authorId !== ctx.userId) {
    throw new Error('Article not found or permission denied');
  }
  const content = article.content || '';
  return {
    content,
    source: {
      id: `article:${article.id}`,
      ownerId: article.authorId,
      sourceType: 'article',
      sourceId: article.id,
      chunkIndex: 0,
      text: content,
      similarity: 1,
      metadata: {
        title: (article as any).title || '',
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
      },
    },
  };
}

async function executeGetNote(args: unknown, ctx: RoteAgentContext): Promise<RoteAgentToolResult> {
  if (ctx.sourceBudget.exhausted()) return { ...exhaustedEvidence(ctx), observations: [] };
  const raw = asRecord(args);
  const sourceType = VALID_SOURCE_TYPES.has(raw.sourceType)
    ? (raw.sourceType as AiSourceType)
    : 'rote';
  const sourceId = typeof raw.sourceId === 'string' ? raw.sourceId.trim() : '';
  if (!sourceId) throw new Error('sourceId is required');

  await ctx.emit({ type: 'tool_progress', toolName: 'rote_get_note', status: 'reading_source' });
  const { source, content } = await loadOwnedSource(ctx, sourceType, sourceId);
  const delivery = deliverReadEvidence(
    ctx,
    source,
    content,
    raw.offset === undefined ? undefined : Number(raw.offset)
  );
  return {
    ...delivery,
    observations: [],
    statePatch: { seenSourceIds: buildSeenSourceIds(ctx, delivery.sources) },
  };
}

async function executeFindRelatedNotes(
  args: unknown,
  ctx: RoteAgentContext
): Promise<RoteAgentToolResult> {
  if (ctx.sourceBudget.exhausted()) return { ...exhaustedEvidence(ctx), observations: [] };
  const raw = asRecord(args);
  const sourceType = VALID_SOURCE_TYPES.has(raw.sourceType)
    ? (raw.sourceType as AiSourceType)
    : 'rote';
  const sourceId = typeof raw.sourceId === 'string' ? raw.sourceId.trim() : '';
  if (!sourceId) throw new Error('sourceId is required');

  await ctx.emit({
    type: 'tool_progress',
    toolName: 'rote_find_related_notes',
    status: 'finding_related',
  });
  const { content } = await loadOwnedSource(ctx, sourceType, sourceId);
  const { sources: foundSources, warnings } = await searchMemory({
    query: content,
    ownerId: ctx.userId,
    sourceTypes: ['rote'],
    limit: normalizeLimit(raw.limit, 8),
    exclude: { sourceType, sourceId },
    excludeIds: sanitizeExcludeIds(ctx.state.seenSourceIds),
  });
  const delivery = deliverSearchEvidence(ctx, foundSources);
  return {
    ...delivery,
    observations: warnings,
    statePatch: { seenSourceIds: buildSeenSourceIds(ctx, delivery.sources) },
  };
}

async function executeGetTags(_args: unknown, ctx: RoteAgentContext): Promise<RoteAgentToolResult> {
  await ctx.emit({ type: 'tool_progress', toolName: 'rote_get_tags', status: 'loading_tags' });
  const rows = await db
    .select({ tags: rotes.tags })
    .from(rotes)
    .where(eq(rotes.authorid, ctx.userId));
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    (Array.isArray(row.tags) ? row.tags : []).forEach((tag) => {
      if (!tag) return;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });
  const tags = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 80);

  return {
    observations: [`Loaded ${tags.length} tag(s).`],
    modelContent: toModelContent({ status: 'ok', tags }),
  };
}

async function executeSkillView(args: unknown): Promise<RoteAgentToolResult> {
  const raw = asRecord(args);
  const name =
    typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : NATIVE_ROTE_SKILLS[0].name;
  const skill = getNativeRoteSkill(name) || NATIVE_ROTE_SKILLS[0];
  return {
    observations: [`Loaded skill ${skill.name}.`],
    modelContent: toModelContent({ status: 'ok', skill }),
  };
}

export function getNativeRoteTools(): RoteAgentTool[] {
  return [
    {
      definition: createSkillViewToolDefinition(),
      execute: executeSkillView,
    },
    {
      definition: createSearchNotesToolDefinition({
        lifecycleScopes: Array.from(VALID_LIFECYCLE_SCOPES),
        taskStatusScopes: Array.from(VALID_TASK_STATUS_SCOPES),
      }),
      execute: executeSearchNotes,
    },
    {
      definition: GET_NOTE_TOOL_DEFINITION,
      execute: executeGetNote,
    },
    {
      definition: FIND_RELATED_NOTES_TOOL_DEFINITION,
      execute: executeFindRelatedNotes,
    },
    {
      definition: GET_TAGS_TOOL_DEFINITION,
      execute: executeGetTags,
    },
  ];
}
