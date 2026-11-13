import { Hono } from 'hono';
import { authenticateMcpOAuth } from '../../middleware/mcpOAuth';
import type { SiteConfig } from '../../types/config';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { getGlobalConfig } from '../../utils/config';
import { getToolByName, getToolsForScopes, toMcpToolResult } from '../../mcp/tools';
import mcpErrors from '../../mcp/errorCodes.json';
import serverInfo from '../../mcp/serverInfo.json';

const mcpRouter = new Hono<{ Variables: HonoVariables }>();
const SERVER_INFO = { name: serverInfo.name, version: serverInfo.version };

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: any;
};

function jsonRpcResult(id: JsonRpcRequest['id'], result: any) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function jsonRpcError(id: JsonRpcRequest['id'], code: number, message: string, data?: any) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]' ||
      url.hostname === '::1'
    );
  } catch {
    return false;
  }
}

function validateOrigin(c: HonoContext): Response | null {
  const origin = c.req.header('origin');
  if (!origin) {
    return null;
  }

  const siteConfig = getGlobalConfig<SiteConfig>('site');
  const allowed = new Set<string>([
    ...(siteConfig?.allowedOrigins || []),
    ...(siteConfig?.frontendUrl ? [siteConfig.frontendUrl] : []),
    c.get('dynamicFrontendUrl') || '',
  ]);

  if (allowed.has(origin) || isLocalOrigin(origin)) {
    return null;
  }

  return c.json({ error: mcpErrors.invalidOrigin }, 403);
}

mcpRouter.get('/', authenticateMcpOAuth, (c: HonoContext) => {
  const originError = validateOrigin(c);
  if (originError) return originError;
  return c.text(serverInfo.sseUnsupported, 405);
});

mcpRouter.delete('/', authenticateMcpOAuth, (c: HonoContext) => {
  const originError = validateOrigin(c);
  if (originError) return originError;
  return c.text(serverInfo.statelessDeleteUnsupported, 405);
});

mcpRouter.post('/', authenticateMcpOAuth, async (c: HonoContext) => {
  const originError = validateOrigin(c);
  if (originError) return originError;

  const body = (await c.req.json().catch(() => null)) as JsonRpcRequest | null;
  if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return c.json(jsonRpcError(null, -32600, mcpErrors.invalidRequest), 400);
  }

  if (body.id === undefined || body.id === null) {
    if (body.method === 'notifications/initialized' || body.method.startsWith('notifications/')) {
      return c.body(null, 202);
    }
    return c.body(null, 202);
  }

  try {
    switch (body.method) {
      case 'initialize': {
        return c.json(
          jsonRpcResult(body.id, {
            protocolVersion: '2025-06-18',
            capabilities: {
              tools: {
                listChanged: false,
              },
            },
            serverInfo: SERVER_INFO,
            instructions: serverInfo.instructions,
          })
        );
      }
      case 'ping':
        return c.json(jsonRpcResult(body.id, {}));
      case 'tools/list': {
        const auth = c.get('mcpAuth');
        const scopes = auth?.scopes || [];
        return c.json(
          jsonRpcResult(body.id, {
            tools: getToolsForScopes(scopes, c.get('user')).map((tool) => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
            })),
          })
        );
      }
      case 'tools/call': {
        const name = body.params?.name;
        if (typeof name !== 'string') {
          return c.json(jsonRpcError(body.id, -32602, mcpErrors.toolNameRequired), 400);
        }
        const tool = getToolByName(name);
        if (!tool) {
          return c.json(jsonRpcError(body.id, -32601, mcpErrors.unknownToolPrefix + name), 404);
        }

        const auth = c.get('mcpAuth');
        const missing = tool.requiredScopes.filter((scope) => !auth?.scopes.includes(scope));
        if (missing.length > 0) {
          c.header(
            'WWW-Authenticate',
            `Bearer error="insufficient_scope", scope="${tool.requiredScopes.join(' ')}"`
          );
          return c.json(
            jsonRpcError(body.id, -32001, mcpErrors.insufficientScope, { missing }),
            403
          );
        }
        if (tool.requiredRole != null) {
          const user = c.get('user');
          if (!user || user.role !== tool.requiredRole) {
            return c.json(jsonRpcError(body.id, -32002, mcpErrors.superAdminRequired), 403);
          }
        }

        const result = await tool.handler(c, body.params?.arguments || {});
        return c.json(jsonRpcResult(body.id, toMcpToolResult(result)));
      }
      default:
        return c.json(
          jsonRpcError(body.id, -32601, mcpErrors.methodNotFoundPrefix + body.method),
          404
        );
    }
  } catch (error: any) {
    return c.json(jsonRpcError(body.id, -32000, error?.message || mcpErrors.mcpToolFailed), 500);
  }
});

export default mcpRouter;
