import type { SemanticSearchResult } from '../../dbMethods/ai';
import { sourceKey, unicodeLength, unicodeSlice } from './sourceBudget';
import type { RoteAgentContext, RoteAgentRetrieval, RoteAgentSourceRegistration } from './types';
import type { RetrievalScope } from '../retrievalTypes';
import { serializeSearchEvidence } from './evidenceFormat';

type SearchEvidenceContext = {
  scope: Omit<RetrievalScope, 'ownerId' | 'cursor' | 'excludeIds'>;
  warnings: string[];
};

function searchBody(source: SemanticSearchResult): string {
  const text = source.text.trim();
  if (source.sourceType !== 'rote' || source.chunkIndex !== 0) return text;
  const title = source.metadata?.title || '';
  const tags = source.metadata?.tags || [];
  // Text search always adds both headers; indexed first chunks omit empty headers.
  const prefix = source.id.startsWith('text:rote:')
    ? `Title: ${title}\nTags: ${tags.join(', ')}\n`
    : `${title ? `Title: ${title}\n` : ''}${tags.length ? `Tags: ${tags.join(', ')}\n` : ''}`;
  if (prefix) {
    if (text.startsWith(prefix)) return text.slice(prefix.length).trim();
    // An indexed chunk may end inside an unusually long metadata prefix.
    if (prefix.trimEnd().startsWith(text)) return '';
  }
  return text;
}

function metadata({ index, source }: RoteAgentSourceRegistration) {
  const value = source.metadata || {};
  return {
    citation: index,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    title: value.title ? unicodeSlice(value.title, 0, 80) : undefined,
    tags: value.tags?.slice(0, 4).map((tag: string) => unicodeSlice(tag, 0, 24)),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    state: value.state,
    archived: value.archived,
  };
}

function retrieval(
  ctx: RoteAgentContext,
  foundCount: number,
  addedCount: number
): RoteAgentRetrieval {
  return {
    foundCount,
    addedCount,
    totalCount: ctx.sourceBudget.snapshot().sourceCount,
    budgetExhausted: ctx.sourceBudget.exhausted(),
  };
}

export function exhaustedEvidence(ctx: RoteAgentContext) {
  return {
    modelContent: JSON.stringify({ status: 'budget_exhausted' }),
    sources: [] as SemanticSearchResult[],
    retrieval: { ...retrieval(ctx, 0, 0), budgetExhausted: true },
  };
}

function controlEvidence(
  ctx: RoteAgentContext,
  payload: Record<string, unknown>,
  foundCount: number,
  maxChars = ctx.sourceBudget.snapshot().remainingSourceChars
) {
  const modelContent = JSON.stringify(payload);
  if (unicodeLength(modelContent) > maxChars) return exhaustedEvidence(ctx);
  ctx.sourceBudget.commit(modelContent, []);
  return {
    modelContent,
    sources: [] as SemanticSearchResult[],
    retrieval: retrieval(ctx, foundCount, 0),
  };
}

export function deliverSearchEvidence(
  ctx: RoteAgentContext,
  found: SemanticSearchResult[],
  search?: SearchEvidenceContext
) {
  if (ctx.sourceBudget.exhausted()) return exhaustedEvidence(ctx);
  const unique = [
    ...new Map(
      found.map((source) => [sourceKey(source), { ...source, text: searchBody(source) }])
    ).values(),
  ];
  const candidates = unique.filter((source) => !ctx.sourceBudget.has(source) && source.text.trim());
  const limit = Math.min(
    ctx.policy.maxSearchResultChars,
    ctx.sourceBudget.snapshot().remainingSourceChars
  );
  const selected: SemanticSearchResult[] = [];
  const payload = (sources: SemanticSearchResult[], snippetChars: number) => ({
    status: sources.length === candidates.length ? 'ok' : 'partial',
    foundCount: found.length,
    ...search,
    sources: ctx.sourceBudget.preview(sources).map((registration) => {
      const text = registration.source.text.trim();
      const excerpt = unicodeSlice(text, 0, snippetChars);
      return {
        ...metadata(registration),
        excerpt,
        truncated: unicodeLength(text) > unicodeLength(excerpt),
      };
    }),
  });
  // Admit minimum useful snippets first, then divide space fairly between them.
  for (const source of candidates) {
    const next = [...selected, source];
    if (unicodeLength(serializeSearchEvidence(payload(next, 80))) <= limit) selected.push(source);
  }
  if (!selected.length) {
    if (candidates.length && limit < ctx.policy.maxSearchResultChars)
      return {
        ...exhaustedEvidence(ctx),
        retrieval: { ...retrieval(ctx, found.length, 0), budgetExhausted: true },
      };
    return controlEvidence(
      ctx,
      { status: 'no_new_content', foundCount: found.length, ...search },
      found.length,
      limit
    );
  }
  let low = 80;
  let high = ctx.policy.maxSearchExcerptChars;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (unicodeLength(serializeSearchEvidence(payload(selected, mid))) <= limit) low = mid;
    else high = mid - 1;
  }
  const modelContent = serializeSearchEvidence(payload(selected, low));
  const delivered = selected.map((source) => ({
    ...source,
    text: unicodeSlice(source.text.trim(), 0, low),
  }));
  ctx.sourceBudget.commit(modelContent, delivered);
  return {
    modelContent,
    sources: delivered,
    retrieval: retrieval(ctx, found.length, delivered.length),
  };
}

export function deliverReadEvidence(
  ctx: RoteAgentContext,
  source: SemanticSearchResult,
  content: string,
  requestedOffset?: number
) {
  if (ctx.sourceBudget.exhausted()) return exhaustedEvidence(ctx);
  const key = sourceKey(source);
  const previousOffset = ctx.sourceBudget.readOffset(key);
  const offset = requestedOffset ?? previousOffset;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > previousOffset)
    throw new Error('Invalid reading offset; use the returned nextOffset');
  const length = unicodeLength(content);
  if (offset < previousOffset || offset >= length || !content.trim()) {
    return controlEvidence(ctx, { status: 'no_new_content', nextOffset: previousOffset }, 1);
  }
  const [registration] = ctx.sourceBudget.preview([source]);
  const payload = (chars: number) => ({
    status: 'ok',
    source: metadata(registration),
    content: unicodeSlice(content, offset, offset + chars),
    offset,
    nextOffset: offset + chars,
    truncated: offset + chars < length,
  });
  let low = Math.min(80, length - offset);
  let high = Math.min(ctx.policy.maxReadChars, length - offset);
  const remaining = ctx.sourceBudget.snapshot().remainingSourceChars;
  if (unicodeLength(JSON.stringify(payload(low))) > remaining) return exhaustedEvidence(ctx);
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (unicodeLength(JSON.stringify(payload(mid))) <= remaining) low = mid;
    else high = mid - 1;
  }
  const modelContent = JSON.stringify(payload(low));
  const delivered = { ...source, text: unicodeSlice(content, offset, offset + low) };
  ctx.sourceBudget.commit(modelContent, [delivered]);
  ctx.sourceBudget.recordRead(key, offset + low);
  return {
    modelContent,
    sources: [delivered],
    retrieval: retrieval(ctx, 1, registration.isNew ? 1 : 0),
  };
}
