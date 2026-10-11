import { Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { authenticateJWT } from '../middleware/jwtAuth';
import type { HonoVariables } from '../types/hono';
import { createResponse } from '../utils/main';
import * as repository from './repository';
import {
  AI_CONVERSATION_MAX_BYTES,
  conversationIdSchema,
  parseAiConversationRevision,
  parseAiConversationWrite,
} from './validation';

type ConversationRepository = Pick<
  typeof repository,
  'listAiConversations' | 'findAiConversation' | 'putAiConversation' | 'deleteAiConversation'
>;

export function createAiConversationRouter(
  store: ConversationRepository = repository,
  authenticate: MiddlewareHandler<{ Variables: HonoVariables }> = authenticateJWT
) {
  const router = new Hono<{ Variables: HonoVariables }>();
  router.use('*', authenticate);
  router.onError((error, c) => {
    if (error.name === 'BodyLimitError') {
      return c.json(createResponse(null, 'ai_conversation_too_large', 1), 413);
    }
    if (error instanceof repository.InvalidAiConversationCursor) {
      return c.json(createResponse(null, 'ai_conversation_invalid_cursor', 1), 400);
    }
    // PostgreSQL errors can embed the private transcript. Log only the operation.
    process.stderr.write(`ai_conversation_request_failed method=${c.req.method}\n`);
    return c.json(createResponse(null, 'ai_conversation_request_failed', 1), 500);
  });
  router.get('/', async (c) => {
    const requestedLimit = c.req.query('limit');
    const limit = requestedLimit === undefined ? 20 : Number(requestedLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return c.json(createResponse(null, 'ai_conversation_invalid_limit', 1), 400);
    }
    const page = await store.listAiConversations(c.get('user')!.id, {
      limit,
      cursor: c.req.query('cursor'),
    });
    return c.json(createResponse(page));
  });
  router.use('/:id', async (c, next) => {
    if (!conversationIdSchema.safeParse(c.req.param('id')).success) {
      return c.json(createResponse(null, 'ai_conversation_invalid_id', 1), 400);
    }
    await next();
  });
  router.get('/:id', async (c) => {
    const conversation = await store.findAiConversation(c.get('user')!.id, c.req.param('id'));
    if (!conversation) {
      return c.json(createResponse(null, 'ai_conversation_not_found', 1), 404);
    }
    return c.json(createResponse({ conversation }));
  });
  router.put(
    '/:id',
    bodyLimit({
      maxSize: AI_CONVERSATION_MAX_BYTES,
      onError: (c) => c.json(createResponse(null, 'ai_conversation_too_large', 1), 413),
    }),
    async (c) => {
      let body: unknown;
      try {
        body = await c.req.json();
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        return c.json(createResponse(null, 'ai_conversation_invalid_snapshot', 1), 400);
      }
      const write = parseAiConversationWrite(body);
      if (!write) {
        return c.json(createResponse(null, 'ai_conversation_invalid_snapshot', 1), 400);
      }
      const result = await store.putAiConversation(c.get('user')!.id, c.req.param('id'), write);
      if (result.kind === 'not_found') {
        return c.json(createResponse(null, 'ai_conversation_not_found', 1), 404);
      }
      return c.json(
        createResponse(
          { conversation: result.conversation },
          result.kind === 'conflict' ? 'ai_conversation_conflict' : 'success',
          result.kind === 'conflict' ? 1 : 0
        ),
        result.kind === 'conflict' ? 409 : 200
      );
    }
  );
  router.delete('/:id', async (c) => {
    const revision = parseAiConversationRevision(c.req.query('baseRevision'));
    if (revision === null) {
      return c.json(createResponse(null, 'ai_conversation_invalid_revision', 1), 400);
    }
    const result = await store.deleteAiConversation(c.get('user')!.id, c.req.param('id'), revision);
    if (result.kind === 'not_found') {
      return c.json(createResponse(null, 'ai_conversation_not_found', 1), 404);
    }
    return c.json(
      createResponse(
        { conversation: result.conversation },
        result.kind === 'conflict' ? 'ai_conversation_conflict' : 'success',
        result.kind === 'conflict' ? 1 : 0
      ),
      result.kind === 'conflict' ? 409 : 200
    );
  });
  return router;
}

export default createAiConversationRouter();
