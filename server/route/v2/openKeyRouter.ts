import { Hono } from 'hono';
import type { HonoVariables } from '../../types/hono';
import { isOpenKeyOk } from '../../utils/main';
import accountRouter from './openKey/account';
import articlesRouter from './openKey/articles';
import attachmentsRouter from './openKey/attachments';
import notesRouter from './openKey/notes';
import reactionsRouter from './openKey/reactions';

const router = new Hono<{ Variables: HonoVariables }>();

router.use('*', isOpenKeyOk);
router.route('/', articlesRouter);
router.route('/', notesRouter);
router.route('/', reactionsRouter);
router.route('/', accountRouter);
router.route('/', attachmentsRouter);

export default router;
