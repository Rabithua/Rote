import { streamSSE } from 'hono/streaming';
import type { RoteAgentStreamEvent } from '../../utils/ai/agent/runtime';

export type AiSseStream = Parameters<Parameters<typeof streamSSE>[1]>[0];

export type AiSseAbortControl = {
  signal: AbortSignal;
  cleanup: () => void;
};

export function createAiSseAbortControl(
  stream: AiSseStream,
  requestSignal: AbortSignal
): AiSseAbortControl {
  const controller = new AbortController();
  const abort = (reason: unknown) => {
    if (!controller.signal.aborted) controller.abort(reason);
  };
  const onRequestAbort = () => abort(requestSignal.reason);

  if (requestSignal.aborted) onRequestAbort();
  else requestSignal.addEventListener('abort', onRequestAbort, { once: true });

  stream.onAbort(() => abort(new DOMException('', 'AbortError')));

  return {
    signal: controller.signal,
    cleanup: () => requestSignal.removeEventListener('abort', onRequestAbort),
  };
}

export async function writeSseEvent(
  stream: AiSseStream,
  event: string,
  data: unknown
): Promise<void> {
  await stream.writeSSE({
    event,
    data: JSON.stringify(data),
  });
}

function normalizeSourcePreview(text: unknown): string {
  return String(text || '')
    .replace(/^(Title:[^\n]*\n)?(Tags:[^\n]*\n)?/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function toClientSource(source: any) {
  const metadata = source?.metadata || {};
  const tags = Array.isArray(metadata.tags)
    ? metadata.tags.filter((tag: unknown) => typeof tag === 'string').slice(0, 8)
    : [];

  return {
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    similarity: Number(source.similarity) || 0,
    retrievalMode: source.retrievalMode || metadata.retrievalMode || 'relevance',
    preview: normalizeSourcePreview(source.text),
    metadata: {
      title: typeof metadata.title === 'string' ? metadata.title : '',
      tags,
      state: typeof metadata.state === 'string' ? metadata.state : undefined,
      archived: typeof metadata.archived === 'boolean' ? metadata.archived : undefined,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      retrievalMode: source.retrievalMode || metadata.retrievalMode || 'relevance',
      retrievalDateField: metadata.retrievalDateField,
    },
  };
}

export async function writeAgentSseEvent(
  stream: AiSseStream,
  event: RoteAgentStreamEvent
): Promise<void> {
  const data = { ...(event as any) };
  delete data.type;
  if (event.type === 'sources') {
    data.sources = Array.isArray(event.sources) ? event.sources.map(toClientSource) : [];
  }
  await writeSseEvent(stream, event.type, data);
}
