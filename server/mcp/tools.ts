import { articleTools } from './articles';
import { attachmentTools } from './attachments';
import { dataTools } from './data';
import { giftTools } from './gift';
import { noteTools } from './notes';
import { noteShareTools } from './noteShares';
import { profileTools } from './profile';
import { reactionTools } from './reactions';
import { settingTools } from './settings';
import { formatToolOutput } from './shared';
import { toolMatchesAccess, type McpToolUser } from './registry';
import type { McpTool, McpToolResult } from './types';

export type { McpTool, McpToolResult } from './types';
export type { McpToolUser } from './registry';

export const mcpTools: McpTool[] = [
  ...noteTools,
  ...noteShareTools,
  ...articleTools,
  ...reactionTools,
  ...profileTools,
  ...dataTools,
  ...settingTools,
  ...attachmentTools,
  ...giftTools,
];

export function getToolsForScopes(scopes: string[], user?: McpToolUser): McpTool[] {
  return mcpTools.filter((tool) => toolMatchesAccess(tool, scopes, user));
}

export function getToolByName(name: string): McpTool | undefined {
  return mcpTools.find((tool) => tool.name === name);
}

export function toMcpToolResult(data: any): McpToolResult {
  return formatToolOutput(data);
}
