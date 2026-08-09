import { addReaction, findRoteById, removeReaction } from '../utils/dbMethods';
import { assertUsersMayInteract } from '../userBlocks/service';
import { ReactionCreateZod } from '../utils/zod';
import mcpErrors from './errorCodes.json';
import { defineMcpTool } from './registry';
import { assertUuid, requireAuth } from './shared';
import type { McpTool } from './types';

export const reactionTools: McpTool[] = [
  defineMcpTool('reactions_add', async (c, args) => {
    const auth = requireAuth(c);
    ReactionCreateZod.parse({ type: args.type, roteid: args.roteid, metadata: args.metadata });
    const note = await findRoteById(args.roteid);
    if (!note) throw new Error(mcpErrors.roteNotFound);
    await assertUsersMayInteract(auth.userId, note.authorid);
    return await addReaction({
      type: args.type,
      roteid: args.roteid,
      userid: auth.userId,
      metadata: args.metadata,
    });
  }),
  defineMcpTool('reactions_remove', async (c, args) => {
    const auth = requireAuth(c);
    assertUuid(args.roteid, 'note_id');
    return await removeReaction({ type: args.type, roteid: args.roteid, userid: auth.userId });
  }),
];
