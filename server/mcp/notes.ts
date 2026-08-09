import type { HonoContext } from '../types/hono';
import { createUserNote, deleteUserNote, updateUserNote } from '../notes/actions';
import { findMyRote, findRoteById, findRotesByIds, searchMyRotes } from '../utils/dbMethods';
import { MAX_BATCH_SIZE } from '../utils/fileValidation';
import { NoteCreateZod, NoteUpdateZod, SearchKeywordZod } from '../utils/zod';
import mcpErrors from './errorCodes.json';
import { defineMcpTool } from './registry';
import {
  assertUuid,
  buildNoteFilter,
  parseArchived,
  parseOptionalInteger,
  parseOptionalLimit,
  processTags,
  requireAuth,
} from './shared';
import type { McpTool } from './types';

async function createNote(c: HonoContext, args: Record<string, any>) {
  const auth = requireAuth(c);
  NoteCreateZod.parse(args);
  return await createUserNote(auth.userId, {
    content: args.content,
    title: args.title || '',
    state: args.state || 'private',
    type: args.type || 'rote',
    tags: processTags(args.tags),
    pin: !!args.pin,
    archived: !!args.archived,
    editor: args.editor,
    articleId: args.articleId,
    articleIds: args.articleIds,
  });
}

async function updateNote(c: HonoContext, args: Record<string, any>) {
  const auth = requireAuth(c);
  const id = assertUuid(args.id, 'note_id');
  NoteUpdateZod.parse(args);
  return await updateUserNote(auth.userId, id, args);
}

export const noteTools: McpTool[] = [
  defineMcpTool('notes_create', createNote),
  defineMcpTool('notes_list', async (c, args) => {
    const auth = requireAuth(c);
    return await findMyRote(
      auth.userId,
      parseOptionalInteger(args.skip, 'skip'),
      parseOptionalLimit(args.limit),
      buildNoteFilter(args),
      parseArchived(args.archived)
    );
  }),
  defineMcpTool('notes_search', async (c, args) => {
    const auth = requireAuth(c);
    SearchKeywordZod.parse({ keyword: args.keyword });
    return await searchMyRotes(
      auth.userId,
      args.keyword,
      parseOptionalInteger(args.skip, 'skip'),
      parseOptionalLimit(args.limit),
      buildNoteFilter(args),
      parseArchived(args.archived)
    );
  }),
  defineMcpTool('notes_get', async (c, args) => {
    const auth = requireAuth(c);
    const id = assertUuid(args.id, 'note_id');
    const note = await findRoteById(id, auth.userId);
    if (!note) throw new Error(mcpErrors.noteNotFound);
    if (note.state === 'public' || note.authorid === auth.userId) return note;
    throw new Error(mcpErrors.notePrivate);
  }),
  defineMcpTool('notes_batch_get', async (c, args) => {
    const auth = requireAuth(c);
    const ids = args.ids as string[];
    if (!Array.isArray(ids) || ids.length === 0) throw new Error(mcpErrors.idsRequired);
    if (ids.length > MAX_BATCH_SIZE) throw new Error(mcpErrors.batchLimitExceeded);
    ids.forEach((id) => assertUuid(id, 'note_id'));
    const notes = await findRotesByIds(ids, auth.userId);
    return notes.filter((note) => note.state === 'public' || note.authorid === auth.userId);
  }),
  defineMcpTool('notes_update', updateNote),
  defineMcpTool('notes_delete', async (c, args) => {
    const auth = requireAuth(c);
    const id = assertUuid(args.id, 'note_id');
    return await deleteUserNote(auth.userId, id);
  }),
];
