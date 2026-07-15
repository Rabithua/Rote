import type { Hono } from 'hono';
import { getUserAiAccess, isAiMemoryAvailableForAccess } from '../../authz/aiAccess';
import type { User } from '../../drizzle/schema';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { getOwnerAiMemoryStats, getPgvectorStatus, getStoredAiConfig } from '../../utils/dbMethods';
import { createResponse } from '../../utils/main';

export function registerAiStatusRoute(router: Hono<{ Variables: HonoVariables }>): void {
  router.get('/status', authenticateJWT, async (c: HonoContext) => {
    const user = c.get('user') as User;
    const config = await getStoredAiConfig();
    const vectorStatus = await getPgvectorStatus();
    const access = await getUserAiAccess(user);
    const eligible = Boolean(
      user.emailVerified || (user as User & { certified?: boolean }).certified
    );
    const memoryStats = await getOwnerAiMemoryStats(user.id);
    const chatBaseUrl = config.chat?.baseUrl || '';
    const isLocalChat =
      /(^https?:\/\/)?(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(chatBaseUrl) ||
      ['ollama', 'llama-cpp'].includes(config.chat?.providerId || '');
    const chatAvailable =
      config.enabled === true &&
      Boolean(config.chat?.baseUrl?.trim()) &&
      Boolean(config.chat?.model?.trim());
    const memoryAvailable = isAiMemoryAvailableForAccess({ access, config, vectorStatus });
    const available = access.chatAllowed && chatAvailable;

    return c.json(
      createResponse({
        enabled: config.enabled,
        vectorEnabled: config.vectorEnabled,
        publicExploreVectorEnabled: config.publicExploreVectorEnabled,
        eligible,
        chatAllowed: access.chatAllowed,
        chatAvailable,
        chatProviderId: config.chat?.providerId || '',
        chatModel: config.chat?.model || '',
        chatMode: config.enabled ? (isLocalChat ? 'local' : 'site') : 'disabled',
        available,
        memoryAvailable,
        memoryStats,
      }),
      200
    );
  });
}
