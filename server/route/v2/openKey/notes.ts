import { Hono } from 'hono';
import { z } from 'zod';
import { createUserNote, deleteUserNote, updateUserNote } from '../../../notes/actions';
import type { HonoContext, HonoVariables } from '../../../types/hono';
import { findMyRote, findRoteById, findRotesByIds, searchMyRotes } from '../../../utils/dbMethods';
import { MAX_BATCH_SIZE } from '../../../utils/fileValidation';
import { createResponse } from '../../../utils/main';
import { NoteCreateZod, NoteUpdateZod, SearchKeywordZod } from '../../../utils/zod';
import {
  assertUuid,
  buildNoteFilter,
  markConvenienceNoteCreate,
  markLegacyNoteCreatePost,
  parseBooleanQueryParameter,
  parseOptionalInteger,
  processTags,
  requireOpenKey,
  requireOpenKeyPerm,
} from './shared';

const router = new Hono<{ Variables: HonoVariables }>();

const NoteBatchZod = z.object({
  ids: z
    .array(z.string().uuid('Invalid note ID'))
    .min(1, 'IDs array is required')
    .max(MAX_BATCH_SIZE, `Maximum ${MAX_BATCH_SIZE} IDs allowed`),
});

function queryTags(c: HonoContext): string[] {
  return processTags([...(c.req.queries('tag') ?? []), ...(c.req.queries('tag[]') ?? [])]);
}

function parsedArchived(value: string | undefined): boolean | undefined {
  return value === undefined ? undefined : value === 'true';
}

async function createNoteFromBody(c: HonoContext) {
  const openKey = requireOpenKey(c);
  const input = NoteCreateZod.parse(await c.req.json());
  const note = await createUserNote(openKey.userid, input);
  return c.json(createResponse(note), 201);
}

router.get('/notes/create', requireOpenKeyPerm('SENDROTE'), async (c: HonoContext) => {
  markConvenienceNoteCreate(c);
  const input = NoteCreateZod.parse({
    content: c.req.query('content'),
    title: c.req.query('title'),
    state: c.req.query('state'),
    tags: queryTags(c),
    pin: parseBooleanQueryParameter(c.req.query('pin'), 'pin'),
    archived: parseBooleanQueryParameter(c.req.query('archived'), 'archived'),
    editor: c.req.query('editor'),
    articleId: c.req.query('articleId'),
  });
  const note = await createUserNote(requireOpenKey(c).userid, input);
  return c.json(createResponse(note), 201);
});

router.post('/notes/create', requireOpenKeyPerm('SENDROTE'), async (c: HonoContext) => {
  markLegacyNoteCreatePost(c);
  return createNoteFromBody(c);
});

router.post('/notes', requireOpenKeyPerm('SENDROTE'), createNoteFromBody);

router.get('/notes', requireOpenKeyPerm('GETROTE'), async (c: HonoContext) => {
  const skip = parseOptionalInteger(
    c.req.query('skip'),
    'Invalid skip parameter: must be a non-negative integer',
    0
  );
  const limit = parseOptionalInteger(
    c.req.query('limit'),
    'Invalid limit parameter: must be a positive integer',
    1
  );
  const filter = buildNoteFilter(c.req.query(), queryTags(c), ['skip', 'limit', 'archived']);
  const notes = await findMyRote(
    requireOpenKey(c).userid,
    skip,
    limit,
    filter,
    parsedArchived(c.req.query('archived'))
  );
  return c.json(createResponse(notes), 200);
});

router.get('/notes/search', requireOpenKeyPerm('GETROTE'), async (c: HonoContext) => {
  const { keyword } = SearchKeywordZod.parse({ keyword: c.req.query('keyword') });
  const skip = parseOptionalInteger(
    c.req.query('skip'),
    'Invalid skip parameter: must be a non-negative integer',
    0
  );
  const limit = parseOptionalInteger(
    c.req.query('limit'),
    'Invalid limit parameter: must be a positive integer',
    1
  );
  const filter = buildNoteFilter(c.req.query(), queryTags(c), [
    'skip',
    'limit',
    'archived',
    'keyword',
  ]);
  const notes = await searchMyRotes(
    requireOpenKey(c).userid,
    keyword,
    skip,
    limit,
    filter,
    parsedArchived(c.req.query('archived'))
  );
  return c.json(createResponse(notes), 200);
});

router.post('/notes/batch', requireOpenKeyPerm('GETROTE'), async (c: HonoContext) => {
  const openKey = requireOpenKey(c);
  const { ids } = NoteBatchZod.parse(await c.req.json());
  const notes = await findRotesByIds(ids, openKey.userid);
  const accessibleNotes = notes.filter(
    (note) => note.state === 'public' || note.authorid === openKey.userid
  );
  return c.json(createResponse(accessibleNotes), 200);
});

router.get('/notes/:id', requireOpenKeyPerm('GETROTE'), async (c: HonoContext) => {
  const openKey = requireOpenKey(c);
  const id = assertUuid(c.req.param('id'), 'Invalid or missing ID');
  const note = await findRoteById(id, openKey.userid);
  if (!note) throw new Error('Note not found');
  if (note.state !== 'public' && note.authorid !== openKey.userid) {
    throw new Error('Access denied: note is private');
  }
  return c.json(createResponse(note), 200);
});

router.put('/notes/:id', requireOpenKeyPerm('EDITROTE'), async (c: HonoContext) => {
  const openKey = requireOpenKey(c);
  const id = assertUuid(c.req.param('id'), 'Invalid or missing ID');
  const input = NoteUpdateZod.parse(await c.req.json());
  const note = await updateUserNote(openKey.userid, id, input);
  return c.json(createResponse(note), 200);
});

router.delete(
  '/notes/:id',
  requireOpenKeyPerm('DELETEROTE', 'EDITROTE'),
  async (c: HonoContext) => {
    const openKey = requireOpenKey(c);
    const id = assertUuid(c.req.param('id'), 'Invalid or missing ID');
    const note = await deleteUserNote(openKey.userid, id);
    return c.json(createResponse(note), 200);
  }
);

export default router;
