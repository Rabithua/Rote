import { createMcpNoteShare, getMcpNoteShare, revokeMcpNoteShare } from '../noteShares/mcpService';
import type { HonoContext } from '../types/hono';
import { defineMcpTool } from './registry';
import { assertUuid, requireAuth } from './shared';
import type { McpTool } from './types';

function noteId(c: HonoContext, args: Record<string, any>) {
  return {
    auth: requireAuth(c),
    id: assertUuid(args.id, 'note_id'),
  };
}

export const noteShareTools: McpTool[] = [
  defineMcpTool('notes_share_get', async (c, args) => {
    const { auth, id } = noteId(c, args);
    return await getMcpNoteShare(auth.userId, id);
  }),
  defineMcpTool('notes_share_create', async (c, args) => {
    const { auth, id } = noteId(c, args);
    return await createMcpNoteShare(auth.userId, id);
  }),
  defineMcpTool('notes_share_revoke', async (c, args) => {
    const { auth, id } = noteId(c, args);
    return await revokeMcpNoteShare(auth.userId, id);
  }),
];
