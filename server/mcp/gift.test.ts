import { describe, expect, it } from 'bun:test';
import { getToolDefinitionsForScopes } from './registry';
import { getToolByName, getToolsForScopes } from './tools';

const GIFT_TOOL_NAMES = ['gift_import_codes', 'gift_status', 'gift_detail'];

const adminUser = { role: 'super_admin' };
const normalUser = { role: 'user' };

function makeContext(user?: { role?: string } | null) {
  return { get: (_key: string) => user } as unknown as Parameters<
    NonNullable<ReturnType<typeof getToolByName>>['handler']
  >[0];
}

describe('MCP gift admin contract', () => {
  it('hides gift tools from scope-based listings and exposes them only to super admins', () => {
    const contentScopes = ['notes:read', 'notes:write', 'notes:share'];
    for (const names of [
      getToolsForScopes(contentScopes).map((tool) => tool.name),
      getToolsForScopes(contentScopes, normalUser).map((tool) => tool.name),
    ]) {
      for (const name of GIFT_TOOL_NAMES) {
        expect(names).not.toContain(name);
      }
    }

    // Admins see the gift tools even with an empty scope grant: the role is
    // the gate, content scopes never unlock server administration.
    const adminNames = getToolsForScopes([], adminUser).map((tool) => tool.name);
    for (const name of GIFT_TOOL_NAMES) {
      expect(adminNames).toContain(name);
    }
    const normalNames = getToolsForScopes([], normalUser).map((tool) => tool.name);
    for (const name of GIFT_TOOL_NAMES) {
      expect(normalNames).not.toContain(name);
    }
  });

  it('keeps gift names out of permissions_get listings for non-admins', () => {
    // permissions_get serves getToolDefinitionsForScopes; it must apply the
    // same role gate as tools/list or gift_* names leak to every client.
    const leakedToListings = getToolDefinitionsForScopes(['notes:read'], normalUser).map(
      (definition) => definition.name
    );
    for (const name of GIFT_TOOL_NAMES) {
      expect(leakedToListings).not.toContain(name);
    }
    const adminListings = getToolDefinitionsForScopes([], adminUser).map(
      (definition) => definition.name
    );
    for (const name of GIFT_TOOL_NAMES) {
      expect(adminListings).toContain(name);
    }
  });

  it('refuses gift tool calls without the super admin role before any handler work', async () => {
    for (const name of GIFT_TOOL_NAMES) {
      const tool = getToolByName(name);
      expect(tool?.requiredRole).toBe('super_admin');
      // The route layer already blocks non-admins; the handler must also fail
      // closed if ever invoked directly.
      await expect(tool!.handler(makeContext(normalUser), {})).rejects.toThrow(
        'super_admin_required'
      );
      await expect(tool!.handler(makeContext(null), {})).rejects.toThrow('super_admin_required');
    }
  });
});
