import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
  AI_MEMORY_UNAVAILABLE_MESSAGE,
  getAiAccessErrorFromAccess,
  getAiMemoryAccessError,
  getUserAiAccess,
  isAiMemoryAvailableForAccess,
} from '../../authz/aiAccess';
import { type User } from '../../drizzle/schema';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import {
  createChatCompletionStreamParts,
  probeChatProviderToolCalling,
  testChatProvider,
} from '../../utils/ai/client';
import { createDirectSiteChat, streamDirectSiteChat } from '../../utils/ai/directChat';
import { runRoteAgentStream } from '../../utils/ai/agent/runtime';
import {
  classifyAiStreamError,
  createAiRunId,
  logAiStreamLifecycle,
} from '../../utils/ai/agent/observability';
import {
  type AiSourceType,
  chatWithRoteContext,
  findArticleById,
  findRoteById,
  getPgvectorStatus,
  getStoredAiConfig,
  logAiTokenUsage,
  prepareRoteChatContext,
  searchMemory,
} from '../../utils/dbMethods';
import { bodyTypeCheck, createResponse } from '../../utils/main';
import {
  createAiSseAbortControl,
  type AiSseStream,
  writeAgentSseEvent,
  writeSseEvent,
} from './aiAgentSse';
import {
  addAiChatStreamUsage,
  createAiChatStreamMetrics,
  type AiChatStreamMetrics,
} from './aiStreamMetrics';
import { registerAdminAiRoutes } from './aiAdmin';
import { registerClientAgentRoutes } from './aiClientAgent';
import { registerAiStatusRoute } from './aiStatus';

const aiRouter = new Hono<{ Variables: HonoVariables }>();
const VALID_AI_SOURCE_TYPES = new Set<AiSourceType>(['rote', 'article']);

function getAiMemoryErrorStatus(message: string): 403 | 503 {
  return message === AI_MEMORY_UNAVAILABLE_MESSAGE ? 503 : 403;
}

async function streamToolPlannedChatResponse(
  stream: AiSseStream,
  user: User,
  body: any,
  message: string,
  signal: AbortSignal,
  metrics: AiChatStreamMetrics
): Promise<void> {
  metrics.phase = 'planning';
  const { config, messages, sources, plan, clarification } = await prepareRoteChatContext({
    ownerId: user.id,
    message,
    limit: body?.limit,
    excludeIds: body?.excludeIds,
    history: body?.history,
    clientContext: body?.clientContext,
    enableThinking: body?.enableThinking === true,
    signal,
    onPlanUsage: (usage) => addAiChatStreamUsage(metrics, usage),
    onPlanThinkingDelta: async (text) => {
      await writeSseEvent(stream, 'thinking', { phase: 'retrieval_planning', text });
    },
    onPlanGenerated: async (generatedPlan) => {
      await writeSseEvent(stream, 'plan', { plan: generatedPlan });
    },
  });
  metrics.toolCallCount = plan.debugTrace.toolCalls.length;
  metrics.sourceCount = sources.length;

  if (clarification) {
    await writeSseEvent(stream, 'clarification', clarification);
    await writeSseEvent(stream, 'done', {});
    return;
  }

  await writeSseEvent(stream, 'sources', { sources });
  metrics.phase = 'answering';

  let emittedText = false;
  let lastUsage: any = null;
  for await (const part of createChatCompletionStreamParts(config.chat, messages, {
    enableThinking: body?.enableThinking === true,
    signal,
  })) {
    if (part.type === 'reasoning') {
      await writeSseEvent(stream, 'thinking', { phase: 'answer', text: part.text });
    } else if (part.type === 'usage') {
      lastUsage = part.usage;
    } else if (part.text) {
      emittedText = true;
      await writeSseEvent(stream, 'delta', { text: part.text });
    }
  }

  if (lastUsage) {
    addAiChatStreamUsage(metrics, lastUsage);
    await logAiTokenUsage({
      userid: user.id,
      model: config.chat.model,
      type: 'chat',
      promptTokens: lastUsage.prompt_tokens,
      completionTokens: lastUsage.completion_tokens,
      totalTokens: lastUsage.total_tokens,
    });
    await writeSseEvent(stream, 'usage', { phase: 'answer', usage: lastUsage });
  }

  if (!emittedText) {
    await writeSseEvent(stream, 'delta', {
      text: sources.length
        ? 'I found related Rote memory, but the model did not return a usable answer. Please try again or narrow the scope.'
        : 'No matching Rote memory was found for this question, so I cannot answer from your notes yet.',
    });
  }

  await writeSseEvent(stream, 'done', {});
}

registerAdminAiRoutes(aiRouter);
registerAiStatusRoute(aiRouter);
registerClientAgentRoutes(aiRouter);

aiRouter.post('/site/test', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const config = await getStoredAiConfig();
  const vectorStatus = await getPgvectorStatus();
  const access = await getUserAiAccess(user);
  const eligible = Boolean(
    user.emailVerified || (user as User & { certified?: boolean }).certified
  );
  const chatAvailable =
    config.enabled === true &&
    Boolean(config.chat?.baseUrl?.trim()) &&
    Boolean(config.chat?.model?.trim());
  const vectorAvailable = config.vectorEnabled === true && vectorStatus.installed === true;

  const accessError = getAiAccessErrorFromAccess(access);
  if (accessError) {
    return c.json(
      createResponse(
        {
          success: false,
          eligible,
          chatAvailable,
          vectorAvailable,
          model: config.chat?.model || '',
        },
        accessError
      ),
      403
    );
  }

  if (!chatAvailable) {
    return c.json(
      createResponse(
        {
          success: false,
          eligible,
          chatAvailable,
          vectorAvailable,
          model: config.chat?.model || '',
        },
        'Site AI chat model is not configured'
      ),
      400
    );
  }

  const startedAt = Date.now();
  await testChatProvider(config.chat);
  const toolCalling = await probeChatProviderToolCalling(config.chat);
  return c.json(
    createResponse(
      {
        success: true,
        eligible,
        chatAvailable,
        vectorAvailable,
        model: config.chat?.model || '',
        latencyMs: Date.now() - startedAt,
        toolCalling,
      },
      !toolCalling.supported
        ? 'Site chat model works, but tool calling was not detected'
        : vectorAvailable
          ? 'Site AI test successful'
          : 'Site chat model works, but memory vector index is not ready'
    ),
    200
  );
});

aiRouter.post('/search', authenticateJWT, bodyTypeCheck, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const accessError = await getAiMemoryAccessError(user);
  if (accessError) {
    return c.json(createResponse(null, accessError), getAiMemoryErrorStatus(accessError));
  }

  const body = await c.req.json();
  const query = String(body?.query || '').trim();

  if (!query) {
    return c.json(createResponse(null, 'Query is required'), 400);
  }

  const { sources: results } = await searchMemory({
    query,
    ownerId: body?.scope === 'public' ? undefined : user.id,
    viewerId: user.id,
    scope: body?.scope === 'public' ? 'public' : 'mine',
    sourceTypes: body?.sourceTypes,
    timeRange: body?.timeRange,
    tags: body?.tags,
    semanticScope: body?.semanticScope,
    state: body?.state,
    archived: typeof body?.archived === 'boolean' ? body.archived : null,
    limit: body?.limit,
  });
  return c.json(createResponse(results), 200);
});

aiRouter.post('/related-notes', authenticateJWT, bodyTypeCheck, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const accessError = await getAiMemoryAccessError(user);
  if (accessError) {
    return c.json(createResponse(null, accessError), getAiMemoryErrorStatus(accessError));
  }

  const body = await c.req.json();
  const sourceType = body?.sourceType as 'rote' | 'article';
  const sourceId = String(body?.sourceId || '');
  let query = '';

  if (sourceType === 'rote') {
    const rote = await findRoteById(sourceId);
    if (!rote || rote.authorid !== user.id) {
      return c.json(createResponse(null, 'Note not found or permission denied'), 404);
    }
    query = `${rote.title || ''}\n${rote.content || ''}`;
  } else if (sourceType === 'article') {
    const article = await findArticleById(sourceId);
    if (!article || article.authorId !== user.id) {
      return c.json(createResponse(null, 'Article not found or permission denied'), 404);
    }
    query = article.content;
  } else {
    return c.json(createResponse(null, 'Invalid source type'), 400);
  }

  const sourceTypes: AiSourceType[] = Array.isArray(body?.sourceTypes)
    ? Array.from(
        new Set<AiSourceType>(
          body.sourceTypes.filter((type: unknown): type is AiSourceType =>
            VALID_AI_SOURCE_TYPES.has(type as AiSourceType)
          )
        )
      )
    : ['rote', 'article'];

  const { sources: results } = await searchMemory({
    query,
    ownerId: user.id,
    sourceTypes,
    limit: body?.limit,
    exclude: { sourceType, sourceId },
  });

  return c.json(createResponse(results), 200);
});

aiRouter.post('/chat', authenticateJWT, bodyTypeCheck, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const access = await getUserAiAccess(user);
  const accessError = getAiAccessErrorFromAccess(access);
  if (accessError) {
    return c.json(createResponse(null, accessError), 403);
  }

  const body = await c.req.json();
  const message = String(body?.message || '').trim();

  if (!message) {
    return c.json(createResponse(null, 'Message is required'), 400);
  }

  const [config, vectorStatus] = await Promise.all([getStoredAiConfig(), getPgvectorStatus()]);
  const memoryAvailable = isAiMemoryAvailableForAccess({ access, config, vectorStatus });
  const result = memoryAvailable
    ? await chatWithRoteContext({
        ownerId: user.id,
        message,
        limit: body?.limit,
        excludeIds: body?.excludeIds,
        history: body?.history,
        clientContext: body?.clientContext,
      })
    : {
        answer: await createDirectSiteChat({
          userId: user.id,
          message,
          history: body?.history,
          clientContext: body?.clientContext,
          enableThinking: body?.enableThinking === true,
        }),
        sources: [],
      };
  return c.json(createResponse(result), 200);
});

aiRouter.post('/agent/stream', authenticateJWT, bodyTypeCheck, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const memoryAccessError = await getAiMemoryAccessError(user);
  if (memoryAccessError) {
    return c.json(
      createResponse(null, memoryAccessError),
      getAiMemoryErrorStatus(memoryAccessError)
    );
  }

  const body = await c.req.json();
  const message = String(body?.message || '').trim();

  if (!message) {
    return c.json(createResponse(null, 'Message is required'), 400);
  }

  return streamSSE(c, async (stream) => {
    const runId = createAiRunId('agent');
    const abortControl = createAiSseAbortControl(stream, c.req.raw.signal);
    let runtimeStarted = false;
    try {
      await stream.write(': connected\n\n');
      const config = await getStoredAiConfig();
      if (!config.enabled) {
        throw new Error('AI is disabled');
      }

      runtimeStarted = true;
      await runRoteAgentStream({
        userId: user.id,
        runId,
        request: {
          message,
          mode: body?.mode,
          history: body?.history,
          state: body?.state,
          selectedContext: body?.selectedContext,
          clientContext: body?.clientContext,
          debug: body?.debug,
          limit: body?.limit,
          previousPlan: body?.previousPlan,
          excludeIds: body?.excludeIds,
          pendingPlan: body?.pendingPlan,
          clarificationAnswer: body?.clarificationAnswer,
          enableThinking: body?.enableThinking === true,
        },
        config,
        emit: (event) => writeAgentSseEvent(stream, event),
        signal: abortControl.signal,
      });
    } catch (error) {
      const failure = classifyAiStreamError(error);
      if (!runtimeStarted) {
        logAiStreamLifecycle('error', 'failed', {
          runId,
          endpoint: 'agent',
          userId: user.id,
          durationMs: 0,
          errorCode: failure.code,
          errorName: error instanceof Error ? error.name : typeof error,
        });
      }
      if (!abortControl.signal.aborted) {
        await writeSseEvent(stream, 'error', { ...failure, runId });
      }
    } finally {
      abortControl.cleanup();
    }
  });
});

aiRouter.post('/chat/stream', authenticateJWT, bodyTypeCheck, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const access = await getUserAiAccess(user);
  const accessError = getAiAccessErrorFromAccess(access);
  if (accessError) {
    return c.json(createResponse(null, accessError), 403);
  }

  const body = await c.req.json();
  const message = String(body?.message || '').trim();

  if (!message) {
    return c.json(createResponse(null, 'Message is required'), 400);
  }

  return streamSSE(c, async (stream) => {
    const runId = createAiRunId('chat');
    const abortControl = createAiSseAbortControl(stream, c.req.raw.signal);
    const metrics = createAiChatStreamMetrics();
    const startedAt = Date.now();
    let model: string | undefined;
    try {
      await stream.write(': connected\n\n');
      await writeSseEvent(stream, 'run_started', { runId });
      const [config, vectorStatus] = await Promise.all([getStoredAiConfig(), getPgvectorStatus()]);
      model = config.chat.model;
      logAiStreamLifecycle('info', 'started', {
        runId,
        endpoint: 'chat',
        userId: user.id,
        model,
        ...metrics,
      });
      if (isAiMemoryAvailableForAccess({ access, config, vectorStatus })) {
        await streamToolPlannedChatResponse(
          stream,
          user,
          body,
          message,
          abortControl.signal,
          metrics
        );
      } else {
        metrics.phase = 'answering';
        const usage = await streamDirectSiteChat({
          userId: user.id,
          message,
          history: body?.history,
          clientContext: body?.clientContext,
          enableThinking: body?.enableThinking === true,
          signal: abortControl.signal,
          onReasoning: (text) => writeSseEvent(stream, 'thinking', { phase: 'answer', text }),
          onContent: (text) => writeSseEvent(stream, 'delta', { text }),
          onUsage: (usage) => writeSseEvent(stream, 'usage', { phase: 'answer', usage }),
        });
        addAiChatStreamUsage(metrics, usage);
        await writeSseEvent(stream, 'done', {});
      }
      logAiStreamLifecycle('info', 'completed', {
        runId,
        endpoint: 'chat',
        userId: user.id,
        model,
        durationMs: Date.now() - startedAt,
        ...metrics,
      });
    } catch (error) {
      const failure = classifyAiStreamError(error);
      logAiStreamLifecycle('error', 'failed', {
        runId,
        endpoint: 'chat',
        userId: user.id,
        model,
        durationMs: Date.now() - startedAt,
        errorCode: failure.code,
        errorName: error instanceof Error ? error.name : typeof error,
        ...metrics,
      });
      if (!abortControl.signal.aborted) {
        await writeSseEvent(stream, 'error', { ...failure, runId });
      }
    } finally {
      abortControl.cleanup();
    }
  });
});

export default aiRouter;
