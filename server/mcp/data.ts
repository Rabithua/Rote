import { getHeatMap, getMyTags, statistics } from '../utils/dbMethods';
import { defineMcpTool, getToolDefinitionsForScopes } from './registry';
import { requireAuth, validateDateRange } from './shared';
import type { McpTool } from './types';

export const dataTools: McpTool[] = [
  defineMcpTool('permissions_get', async (c) => {
    const auth = requireAuth(c);
    return {
      clientId: auth.clientId,
      userId: auth.userId,
      scopes: auth.scopes,
      tools: getToolDefinitionsForScopes(auth.scopes, c.get('user')).map((tool) => tool.name),
    };
  }),
  defineMcpTool('tags_get', async (c) => await getMyTags(requireAuth(c).userId)),
  defineMcpTool('heatmap_get', async (c, args) => {
    validateDateRange(args.startDate, args.endDate);
    return await getHeatMap(requireAuth(c).userId, args.startDate, args.endDate);
  }),
  defineMcpTool('statistics_get', async (c) => await statistics(requireAuth(c).userId)),
];
