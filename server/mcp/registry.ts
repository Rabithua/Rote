import mcpErrors from './errorCodes.json';
import rawDefinitions from './toolDefinitions.json';
import type { McpTool, McpToolDefinition } from './types';

const toolDefinitions = rawDefinitions as McpToolDefinition[];
const definitionByName = new Map(
  toolDefinitions.map((definition) => [definition.name, definition])
);

export function defineMcpTool(name: string, handler: McpTool['handler']): McpTool {
  const definition = definitionByName.get(name);
  if (!definition) {
    throw new Error(mcpErrors.toolDefinitionMissingPrefix + name);
  }
  return { ...definition, handler };
}

export type McpToolUser = { role?: string | null } | undefined | null;

// Single access predicate for every tool-listing path (tools/list,
// permissions_get): scope grants gate content tools, requiredRole gates
// server-administration tools. Two filters existed once and drifted — the
// gift_* names leaked to non-admins through this file's listing.
export function toolMatchesAccess(
  tool: Pick<McpToolDefinition, 'requiredScopes' | 'requiredRole'>,
  scopes: string[],
  user: McpToolUser
): boolean {
  return (
    tool.requiredScopes.every((scope) => scopes.includes(scope)) &&
    (tool.requiredRole == null || user?.role === tool.requiredRole)
  );
}

export function getToolDefinitionsForScopes(
  scopes: string[],
  user?: McpToolUser
): McpToolDefinition[] {
  return toolDefinitions.filter((tool) => toolMatchesAccess(tool, scopes, user));
}
