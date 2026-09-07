import { articleTools } from './articles';
import { attachmentTools } from './attachments';
import { dataTools } from './data';
import { noteTools } from './notes';
import { noteShareTools } from './noteShares';
import { profileTools } from './profile';
import { reactionTools } from './reactions';
import { settingTools } from './settings';
import { formatToolOutput } from './shared';
import type { McpTool, McpToolResult } from './types';

export type { McpTool, McpToolResult } from './types';

export const mcpTools: McpTool[] = [
  ...noteTools,
  ...noteShareTools,
  ...articleTools,
  ...reactionTools,
  ...profileTools,
  ...dataTools,
  ...settingTools,
  ...attachmentTools,
];

export function getToolsForScopes(scopes: string[]): McpTool[] {
  return mcpTools.filter((tool) => tool.requiredScopes.every((scope) => scopes.includes(scope)));
}

export function getToolByName(name: string): McpTool | undefined {
  return mcpTools.find((tool) => tool.name === name);
}

export function toMcpToolResult(data: any): McpToolResult {
  return formatToolOutput(data);
}
