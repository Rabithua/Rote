import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getDefaultStore } from 'jotai';
import { aiChatMessagesAtom, aiRunStateAtom } from '@/state/aiChat';
import { startAiRun, stopAiRun } from '@/state/aiRunManager';
import type { AiRunLabels } from '@/state/aiRunHandlers';
import {
  activateAiConversationScope,
  aiConversationViewAtom,
  importLegacyAiConversation,
  retryAiConversationSync,
} from './runtime';
import { cacheKey, conversationScope } from './storage';
import type { Conversation } from './types';

const backend = vi.hoisted(() => ({
  rows: new Map<string, any>(),
  writes: vi.fn(),
  failLoad: false,
}));
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return {
    ...actual,
    isCurrentConversationScope: () => true,
    conversationApi: {
      list: async () => {
        if (backend.failLoad) throw new Error('offline history');
        return { conversations: structuredClone([...backend.rows.values()]), nextCursor: null };
      },
      put: async (_scope: unknown, id: string, snapshot: any, baseRevision: number | null) => {
        backend.writes(snapshot, baseRevision);
        const row = {
          ...structuredClone(snapshot),
          id,
          revision: (backend.rows.get(id)?.revision || 0) + 1,
          updatedAt: new Date().toISOString(),
          deletedAt: null,
        };
        backend.rows.set(id, row);
        return row;
      },
      delete: vi.fn(),
    },
  };
});

const labels: AiRunLabels = {
  phase: (phase) => phase,
  toolStarted: (name) => name,
  toolStatus: (status) => status,
  toolFinished: (name) => name,
  sourcesFound: String,
  sourcesAdded: String,
  askFailed: 'failed',
  streamInterrupted: 'interrupted',
  streamTimeout: 'timeout',
  streamTruncated: 'truncated',
  fallbackNoAnswerWithSources: 'no answer',
  fallbackNoAnswerNoSources: 'no answer',
};
const scope = conversationScope('https://rote.example/v2/api', 'user-a');
const store = getDefaultStore();
const params = {
  question: 'question',
  messages: [],
  pendingPlan: null,
  unavailable: false,
  mode: 'site' as const,
  toolsAvailable: true,
  labels,
};

beforeEach(async () => {
  localStorage.clear();
  backend.rows.clear();
  backend.writes.mockClear();
  backend.failLoad = false;
  await activateAiConversationScope(scope, 'interrupted');
});
afterEach(async () => {
  stopAiRun();
  await activateAiConversationScope(null, 'interrupted');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('persists start and terminal snapshots once without storing provider fragments', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          [
            'event: run_started\ndata: {"runId":"agent-1"}',
            'event: output_started\ndata: {"outputId":"round","phase":"answering"}',
            'event: thinking\ndata: {"outputId":"round","phase":"answer","text":"reasoning"}',
            'event: delta\ndata: {"outputId":"round","phase":"answering","text":"answer"}',
            'event: output_finished\ndata: {"outputId":"round","phase":"answering","kind":"answer"}',
            'event: done\ndata: {}',
          ].join('\n\n') + '\n\n'
        )
    )
  );
  await startAiRun(params);
  await retryAiConversationSync();
  expect(backend.writes).toHaveBeenCalledTimes(2);
  expect(backend.writes.mock.calls[0][0].messages[1]).toMatchObject({
    error: true,
    errorDetail: 'interrupted',
  });
  const final = [...backend.rows.values()][0] as Conversation;
  expect(final.agentConversationId).toBe('agent-1');
  expect(final.messages[1]).toMatchObject({
    content: 'answer',
    outputs: [{ id: 'round', kind: 'answer', thinking: 'reasoning' }],
  });
  expect(final.messages[1]).not.toHaveProperty('isStreaming');
  expect(final.messages[1].outputs?.[0]).not.toHaveProperty('text');
});

it('persists terminal failure with received process output and thinking', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          'event: output_started\ndata: {"outputId":"step","phase":"planning"}\n\nevent: thinking\ndata: {"outputId":"step","phase":"route_decision","text":"reasoning"}\n\nevent: delta\ndata: {"outputId":"step","phase":"planning","text":"process"}\n\n'
        )
    )
  );
  await startAiRun(params);
  await retryAiConversationSync();
  const final = [...backend.rows.values()][0] as Conversation;
  expect(final.messages[1]).toMatchObject({
    error: true,
    errorDetail: 'interrupted',
    outputs: [{ id: 'step', thinking: 'reasoning', text: 'process' }],
  });
  expect(final.messages[1]).not.toHaveProperty('isStreaming');
});

it('settles and stops an active stream on remote tombstone, retains delivered content, then permits a new run', async () => {
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              stream = controller;
              controller.enqueue(
                encoder.encode('event: delta\ndata: {"text":"partial answer"}\n\n')
              );
            },
          })
        )
    )
  );
  const running = startAiRun(params);
  await vi.waitFor(() => expect(store.get(aiChatMessagesAtom)[1]?.content).toBe('partial answer'));
  const id = store.get(aiConversationViewAtom).selectedId!;
  const remote = backend.rows.get(id);
  backend.rows.set(id, {
    ...remote,
    revision: remote.revision + 1,
    deletedAt: new Date().toISOString(),
    messages: [],
  });
  await retryAiConversationSync();
  expect(store.get(aiRunStateAtom).isSending).toBe(false);
  expect(store.get(aiChatMessagesAtom)).toEqual([]);
  const cache = JSON.parse(localStorage.getItem(cacheKey(scope))!);
  expect(cache.pending[id].snapshot.messages[1].content).toBe('partial answer');
  expect(cache.pending[id].conflict.deletedAt).toBeTruthy();
  stream.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
  stream.close();
  await running;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('event: delta\ndata: {"text":"new answer"}\n\nevent: done\ndata: {}\n\n')
    )
  );
  expect(await startAiRun(params)).toBe(true);
  expect(store.get(aiRunStateAtom).isSending).toBe(false);
  expect(store.get(aiChatMessagesAtom)[1].content).toBe('new answer');
});

it('flushes received output fragments during remote deletion even before their display frame', async () => {
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              stream = controller;
              controller.enqueue(
                encoder.encode(
                  'event: output_started\ndata: {"outputId":"pending-round","phase":"planning"}\n\nevent: thinking\ndata: {"outputId":"pending-round","phase":"route_decision","text":"received thought"}\n\nevent: delta\ndata: {"outputId":"pending-round","phase":"planning","text":"received process"}\n\n'
                )
              );
            },
          })
        )
    )
  );
  const running = startAiRun(params);
  await vi.waitFor(() =>
    expect(store.get(aiChatMessagesAtom)[1]?.outputs?.[0]?.outputId).toBe('pending-round')
  );
  expect(store.get(aiChatMessagesAtom)[1].outputs?.[0].text).toBeUndefined();
  const id = store.get(aiConversationViewAtom).selectedId!;
  const row = backend.rows.get(id);
  backend.rows.set(id, {
    ...row,
    revision: row.revision + 1,
    deletedAt: new Date().toISOString(),
    messages: [],
  });
  await retryAiConversationSync();
  const cache = JSON.parse(localStorage.getItem(cacheKey(scope))!);
  expect(cache.pending[id].snapshot.messages[1].outputs[0]).toMatchObject({
    text: 'received process',
    thinking: 'received thought',
  });
  stream.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
  stream.close();
  await running;
});

it('keeps cached history and next provider context when legacy import is clicked after initial load failure', async () => {
  const fetch = vi.fn(
    async () =>
      new Response('event: delta\ndata: {"text":"cached answer"}\n\nevent: done\ndata: {}\n\n')
  );
  vi.stubGlobal('fetch', fetch);
  await startAiRun(params);
  await retryAiConversationSync();
  const cached = structuredClone(store.get(aiChatMessagesAtom));
  const id = store.get(aiConversationViewAtom).selectedId;
  localStorage.setItem(
    'aiChatMessages',
    JSON.stringify([{ id: 'legacy', role: 'user', content: 'old browser history' }])
  );
  backend.failLoad = true;
  await activateAiConversationScope(scope, 'interrupted');
  expect(store.get(aiConversationViewAtom)).toMatchObject({
    issue: 'load',
    hasLegacy: true,
    canImportLegacy: false,
  });
  importLegacyAiConversation();
  expect(store.get(aiChatMessagesAtom)).toEqual(cached);
  expect(store.get(aiConversationViewAtom).selectedId).toBe(id);
  await startAiRun({ ...params, question: 'continue', messages: cached });
  const request = JSON.parse((fetch.mock.calls.at(-1) as any)[1].body);
  expect(request.history).toEqual(cached.map(({ role, content }) => ({ role, content })));
  const cache = JSON.parse(localStorage.getItem(cacheKey(scope))!);
  expect(cache.pending[id!].snapshot.messages).toHaveLength(4);
  expect(cache.pending[id!].snapshot.messages[0].content).toBe('question');
});

it('preserves the generation base and exposes conflict when another device changes an acknowledged start snapshot', async () => {
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              stream = controller;
              controller.enqueue(
                encoder.encode('event: delta\ndata: {"text":"my partial answer"}\n\n')
              );
            },
          })
        )
    )
  );
  const running = startAiRun(params);
  await vi.waitFor(() =>
    expect(store.get(aiChatMessagesAtom)[1]?.content).toBe('my partial answer')
  );
  const id = store.get(aiConversationViewAtom).selectedId!;
  const other = {
    ...backend.rows.get(id),
    revision: 2,
    messages: [
      {
        id: 'other-question',
        role: 'user',
        content: 'another device conversation',
        createdAt: new Date().toISOString(),
      },
    ],
  };
  backend.rows.set(id, other);
  await retryAiConversationSync();
  expect(store.get(aiConversationViewAtom).issue).toBe('conflict');
  expect(store.get(aiChatMessagesAtom)[1].content).toBe('my partial answer');
  stream.enqueue(
    encoder.encode('event: delta\ndata: {"text":" completed"}\n\nevent: done\ndata: {}\n\n')
  );
  stream.close();
  await running;
  await retryAiConversationSync();
  expect(backend.writes).toHaveBeenCalledTimes(1);
  expect(backend.rows.get(id)).toEqual(other);
  const cache = JSON.parse(localStorage.getItem(cacheKey(scope))!);
  expect(cache.conversations[id].revision).toBe(1);
  expect(cache.pending[id].conflict.revision).toBe(2);
  expect(cache.pending[id].snapshot.messages[1].content).toBe('my partial answer completed');
});
