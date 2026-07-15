import type { Hono } from 'hono';
import {
  AI_MEMORY_UNAVAILABLE_MESSAGE,
  getAiAccessErrorFromAccess,
  getUserAiAccess,
  isAiMemoryAvailableForAccess,
} from '../../authz/aiAccess';
import { type User } from '../../drizzle/schema';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import {
  buildFinalAnswerInstruction,
  buildRoteAgentSystemPrompt,
} from '../../utils/ai/agent/prompt';
import { executeClientRoteTool } from '../../utils/ai/agent/clientRuntime';
import { getNativeRoteTools } from '../../utils/ai/agent/tools';
import { DEFAULT_AGENT_POLICY } from '../../utils/ai/agent/types';
import { getPgvectorStatus, getStoredAiConfig } from '../../utils/dbMethods';
import { bodyTypeCheck, createResponse } from '../../utils/main';

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
    ? metadata.tags.filter((tag: unknown) => typeof tag === `string`).slice(0, 8)
    : [];

  return {
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    similarity: Number(source.similarity) || 0,
    retrievalMode: source.retrievalMode || metadata.retrievalMode || 'relevance',
    preview: normalizeSourcePreview(source.text),
    metadata: {
      title: typeof metadata.title === `string` ? metadata.title : '',
      tags,
      state: typeof metadata.state === `string` ? metadata.state : undefined,
      archived: typeof metadata.archived === 'boolean' ? metadata.archived : undefined,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      retrievalMode: source.retrievalMode || metadata.retrievalMode || 'relevance',
      retrievalDateField: metadata.retrievalDateField,
    },
  };
}

function sanitizeClientWarning(value: unknown): string {
  return String(value || '').trim();
}

function sanitizeWarningArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(sanitizeClientWarning).filter(Boolean)));
}

function sanitizeClientPlan(plan: any) {
  if (!plan) return plan;
  return {
    ...plan,
    toolResult: plan.toolResult
      ? {
          ...plan.toolResult,
          warnings: sanitizeWarningArray(plan.toolResult.warnings),
        }
      : plan.toolResult,
    debugTrace: plan.debugTrace
      ? {
          ...plan.debugTrace,
          warnings: sanitizeWarningArray(plan.debugTrace.warnings),
        }
      : plan.debugTrace,
  };
}

function sanitizeClientModelContent(value: string): string {
  try {
    const parsed = JSON.parse(value);
    if (parsed?.plan?.warnings) {
      parsed.plan.warnings = sanitizeWarningArray(parsed.plan.warnings);
    }
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

async function getClientToolConfig(user: User) {
  const [config, vectorStatus, access] = await Promise.all([
    getStoredAiConfig(),
    getPgvectorStatus(),
    getUserAiAccess(user),
  ]);
  const memoryAvailable = isAiMemoryAvailableForAccess({ access, config, vectorStatus });

  return {
    config,
    memoryAvailable,
    accessError: getAiAccessErrorFromAccess(access),
  };
}

export function registerClientAgentRoutes(router: Hono<{ Variables: HonoVariables }>) {
  router.get('/client-agent/bootstrap', authenticateJWT, async (c: HonoContext) => {
    const user = c.get('user') as User;
    const { accessError, memoryAvailable } = await getClientToolConfig(user);

    if (accessError) return c.json(createResponse(null, accessError), 403);
    if (!memoryAvailable) {
      return c.json(createResponse(null, AI_MEMORY_UNAVAILABLE_MESSAGE), 503);
    }

    const policy = {
      maxIterations: DEFAULT_AGENT_POLICY.maxIterations,
      maxToolCalls: DEFAULT_AGENT_POLICY.maxToolCalls,
      maxSources: DEFAULT_AGENT_POLICY.maxSources,
      maxSourceChars: DEFAULT_AGENT_POLICY.maxSourceChars,
    };

    return c.json(
      createResponse({
        systemPrompt: buildRoteAgentSystemPrompt('chat'),
        finalAnswerInstruction: buildFinalAnswerInstruction(),
        tools: getNativeRoteTools().map((tool) => tool.definition),
        policy,
      }),
      200
    );
  });

  router.post(
    '/client-agent/tools/execute',
    authenticateJWT,
    bodyTypeCheck,
    async (c: HonoContext) => {
      const user = c.get('user') as User;
      const body = await c.req.json();
      const { config, accessError, memoryAvailable } = await getClientToolConfig(user);

      if (accessError) return c.json(createResponse(null, accessError), 403);
      if (!memoryAvailable) {
        return c.json(createResponse(null, AI_MEMORY_UNAVAILABLE_MESSAGE), 503);
      }

      const result = await executeClientRoteTool({
        userId: user.id,
        config,
        toolName: body?.toolName,
        arguments: body?.arguments,
        request: body?.request,
        state: body?.state,
        sourceKeys: body?.sourceKeys,
        sourceCharsUsed: body?.sourceCharsUsed,
      });

      return c.json(
        createResponse({
          observations: result.observations.map(sanitizeClientWarning),
          displaySummary: result.displaySummary,
          modelContent: sanitizeClientModelContent(result.modelContent),
          sources: Array.isArray(result.sources) ? result.sources.map(toClientSource) : [],
          plan: sanitizeClientPlan(result.plan),
          statePatch: result.statePatch,
          state: result.state,
          sourceKeys: result.sourceKeys,
          sourceCharsUsed: result.sourceCharsUsed,
          clarification: result.clarification,
        }),
        200
      );
    }
  );
}
