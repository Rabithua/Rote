import type { HonoContext } from '../types/hono';

export type McpToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export type McpToolDefinition = {
  name: string;
  description: string;
  requiredScopes: string[];
  // Role-restricted tools are hidden from tools/list and refused on tools/call
  // unless the authenticated user holds the role. Handlers re-check (defense
  // in depth) via requireSuperAdmin in shared.ts.
  requiredRole?: 'super_admin';
  inputSchema: Record<string, any>;
};

export type McpTool = McpToolDefinition & {
  handler: (c: HonoContext, args: Record<string, any>) => Promise<any>;
};
