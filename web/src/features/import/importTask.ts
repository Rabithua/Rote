import { del, post } from '@/utils/api';
import type { ImportMigrationAuth, ImportPayload } from './sourceLoader';

const IMPORT_CHUNK_SIZE = 50;
const DEFAULT_CONCURRENCY = 8;
const DEGRADED_CONCURRENCY = 4;
const VIDEO_CONCURRENCY = 2;
const INTERRUPTED_TASK_KEY = 'rote:interrupted-import';

type ApiResponse<T> = { code: number; message: string; data: T };
type ImportRecord = Record<string, any>;

export type ImportTaskStage =
  | 'planning'
  | 'migrating'
  | 'importing'
  | 'cleaning'
  | 'completed'
  | 'interrupted';

export type ImportTaskProgress = {
  stage: ImportTaskStage;
  notesCompleted: number;
  notesTotal: number;
  attachmentsActive: number;
  attachmentsCompleted: number;
  attachmentsFailed: number;
  attachmentsTotal: number;
};

export type ImportAttachmentFailure = {
  attachmentName: string;
  noteTitle: string;
  provider: string;
  reason: string;
};

export type ImportTaskResult = {
  notes: { total: number; created: number; updated: number; unchanged: number };
  articles: { total: number; created: number; updated: number };
  attachments: { total: number; created: number; updated: number; deleted: number; failed: number };
  skippedAfterAttachmentFailure: number;
  failures: ImportAttachmentFailure[];
};

export async function runImportTask({
  payload,
  overwriteExisting,
  preserveVisibility,
  signal,
  onProgress,
  migrationAuth,
}: {
  payload: ImportPayload;
  overwriteExisting: boolean;
  preserveVisibility: boolean;
  signal: AbortSignal;
  onProgress: (progress: ImportTaskProgress) => void;
  migrationAuth?: ImportMigrationAuth;
}): Promise<ImportTaskResult> {
  const importOptions = {
    existingStrategy: overwriteExisting ? 'overwrite' : 'skip',
    visibilityStrategy: preserveVisibility ? 'preserve' : 'private',
  } as const;
  let progress: ImportTaskProgress = {
    stage: 'planning',
    notesCompleted: 0,
    notesTotal: payload.notes.length,
    attachmentsActive: 0,
    attachmentsCompleted: 0,
    attachmentsFailed: 0,
    attachmentsTotal: 0,
  };
  const update = (next: Partial<ImportTaskProgress>) => {
    progress = { ...progress, ...next };
    onProgress(progress);
  };
  update({});

  const plan = await post<ApiResponse<{ noteIndexes: number[] }>>(
    '/users/me/import/plan',
    { ...payload, importOptions },
    { signal }
  );
  const plannedNotes = plan.data.noteIndexes.map((index) => payload.notes[index] as ImportRecord);
  const attachmentTotal = plannedNotes.reduce(
    (total, note) => total + (Array.isArray(note.attachments) ? note.attachments.length : 0),
    0
  );
  update({
    stage: 'migrating',
    notesTotal: plannedNotes.length,
    attachmentsTotal: attachmentTotal,
  });

  const session = createInterruptedSession();
  const failures: ImportAttachmentFailure[] = [];
  const result = emptyResult(payload.notes.length - plannedNotes.length);
  let skippedAfterAttachmentFailure = 0;
  let sentArticles = false;

  try {
    const noteChunks = chunkValues(plannedNotes, IMPORT_CHUNK_SIZE);
    if (noteChunks.length === 0 && (payload.articles?.length ?? 0) > 0) noteChunks.push([]);
    for (const chunk of noteChunks) {
      throwIfAborted(signal);
      const { notes: migratedNotes, failedNoteIndexes } = await migrateChunk(
        chunk,
        signal,
        session,
        failures,
        migrationAuth,
        (delta) => {
          update({
            attachmentsActive: progress.attachmentsActive + delta.active,
            attachmentsCompleted: progress.attachmentsCompleted + delta.completed,
            attachmentsFailed: progress.attachmentsFailed + delta.failed,
          });
        }
      );
      const noteIndexesToSkip = overwriteExisting ? failedNoteIndexes : new Set<number>();
      const migratedIdsToDiscard = migratedNotes.flatMap((note, noteIndex) =>
        noteIndexesToSkip.has(noteIndex)
          ? (note.attachments ?? []).map((attachment: ImportRecord) => attachment.id)
          : []
      );
      if (migratedIdsToDiscard.length > 0) {
        await cleanupAttachmentIds(migratedIdsToDiscard);
        removeAttachmentIds(session, migratedIdsToDiscard);
      }
      const importableNotes = migratedNotes.filter((note, noteIndex) => {
        if (noteIndexesToSkip.has(noteIndex)) {
          skippedAfterAttachmentFailure += 1;
          return false;
        }
        const importable = hasContent(note) || (note.attachments?.length ?? 0) > 0;
        if (!importable) skippedAfterAttachmentFailure += 1;
        return importable;
      });
      const shouldImportArticles = !sentArticles && (payload.articles?.length ?? 0) > 0;
      if (importableNotes.length === 0 && !shouldImportArticles) {
        update({ notesCompleted: progress.notesCompleted + chunk.length });
        continue;
      }

      update({ stage: 'importing' });
      const response = await post<ApiResponse<ImportTaskResult>>(
        '/users/me/import',
        {
          ...payload,
          notes: importableNotes,
          articles: sentArticles ? [] : (payload.articles ?? []),
          importOptions,
        },
        { signal, timeout: 300_000 }
      );
      sentArticles = true;
      mergeResult(result, response.data);
      removeBoundIds(session, importableNotes);
      update({
        stage: 'migrating',
        notesCompleted: progress.notesCompleted + chunk.length,
      });
    }

    clearInterruptedSession();
    update({ stage: 'completed', notesCompleted: plannedNotes.length });
    return {
      ...result,
      attachments: { ...result.attachments, failed: failures.length },
      skippedAfterAttachmentFailure,
      failures,
    };
  } catch (error) {
    update({ stage: signal.aborted ? 'interrupted' : 'cleaning' });
    await cleanupAttachmentIds(session.attachmentIds);
    clearInterruptedSession();
    throw error;
  }
}

export async function cleanupInterruptedImport() {
  const session = readInterruptedSession();
  if (!session?.attachmentIds.length) {
    clearInterruptedSession();
    return 0;
  }
  await cleanupAttachmentIds(session.attachmentIds);
  clearInterruptedSession();
  return session.attachmentIds.length;
}

async function migrateChunk(
  notes: ImportRecord[],
  signal: AbortSignal,
  session: InterruptedSession,
  failures: ImportAttachmentFailure[],
  migrationAuth: ImportMigrationAuth | undefined,
  onDelta: (delta: { active: number; completed: number; failed: number }) => void
) {
  const output = notes.map((note) => ({ ...note, attachments: [] as ImportRecord[] }));
  const failedNoteIndexes = new Set<number>();
  const tasks = notes.flatMap((note, noteIndex) =>
    (Array.isArray(note.attachments) ? note.attachments : []).map(
      (attachment: ImportRecord, attachmentIndex: number) => ({
        note,
        noteIndex,
        attachment,
        attachmentIndex,
        video: isVideoAttachment(attachment),
      })
    )
  );

  await runAttachmentQueue(tasks, signal, async (task, degrade) => {
    onDelta({ active: 1, completed: 0, failed: 0 });
    try {
      const migrated = await migrateWithRetry(
        task.attachment,
        signal,
        degrade,
        undefined,
        migrationAuth
      );
      output[task.noteIndex].attachments.push({
        ...migrated,
        sortIndex: task.attachment.sortIndex ?? task.attachmentIndex,
        source: task.attachment.source,
      });
      session.attachmentIds.push(migrated.id);
      persistInterruptedSession(session);
      onDelta({ active: -1, completed: 1, failed: 0 });
    } catch (error) {
      if (signal.aborted) throw error;
      failedNoteIndexes.add(task.noteIndex);
      failures.push({
        attachmentName: attachmentName(task.attachment, task.attachmentIndex),
        noteTitle: String(task.note.title || ''),
        provider: String(task.note.source?.provider || 'rote'),
        reason: migrationErrorCode(error),
      });
      onDelta({ active: -1, completed: 1, failed: 1 });
    }
  });
  output.forEach((note) =>
    note.attachments.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
  );
  return { notes: output, failedNoteIndexes };
}

export async function migrateWithRetry(
  attachment: ImportRecord,
  signal: AbortSignal,
  degrade: () => void,
  migrate: (
    attachment: ImportRecord,
    signal: AbortSignal,
    migrationAuth?: ImportMigrationAuth
  ) => Promise<ImportRecord> = migrateAttachment,
  migrationAuth?: ImportMigrationAuth
) {
  try {
    return await migrate(attachment, signal, migrationAuth);
  } catch (error) {
    if (!isTransient(error)) throw error;
    degrade();
    return migrate(attachment, signal, migrationAuth);
  }
}

async function migrateAttachment(
  attachment: ImportRecord,
  signal: AbortSignal,
  migrationAuth?: ImportMigrationAuth
) {
  const response = await post<ApiResponse<ImportRecord>>(
    '/imports/attachments/migrate',
    {
      attachment,
      migrationAuth: migrationAuth
        ? { provider: migrationAuth.provider, baseUrl: migrationAuth.baseUrl }
        : undefined,
    },
    {
      signal,
      timeout: 300_000,
      headers: migrationAuth ? { 'x-memos-access-token': migrationAuth.token } : undefined,
    }
  );
  return response.data;
}

export async function runAttachmentQueue<T extends { video: boolean }>(
  tasks: T[],
  signal: AbortSignal,
  worker: (task: T, degrade: () => void) => Promise<void>
) {
  const pending = [...tasks];
  let active = 0;
  let activeVideos = 0;
  let concurrency = DEFAULT_CONCURRENCY;

  await new Promise<void>((resolve, reject) => {
    const schedule = () => {
      if (signal.aborted) {
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        return;
      }
      while (active < concurrency && pending.length > 0) {
        const index = pending.findIndex((task) => !task.video || activeVideos < VIDEO_CONCURRENCY);
        if (index < 0) break;
        const [task] = pending.splice(index, 1);
        active += 1;
        if (task.video) activeVideos += 1;
        worker(task, () => {
          concurrency = DEGRADED_CONCURRENCY;
        })
          .catch((error) => {
            if (isTransient(error)) concurrency = DEGRADED_CONCURRENCY;
            if (signal.aborted) reject(error);
          })
          .finally(() => {
            active -= 1;
            if (task.video) activeVideos -= 1;
            if (pending.length === 0 && active === 0) resolve();
            else schedule();
          });
      }
      if (pending.length === 0 && active === 0) resolve();
    };
    schedule();
  });
}

function isTransient(error: unknown) {
  const status = (error as { response?: { status?: number }; code?: string })?.response?.status;
  const code = (error as { code?: string })?.code;
  return status === 429 || status === 503 || code === 'ECONNABORTED' || code === 'ETIMEDOUT';
}

function migrationErrorCode(error: unknown) {
  const message = (error as { response?: { data?: { message?: string } }; message?: string })
    ?.response?.data?.message;
  return message || (error instanceof Error ? error.message : 'remote_attachment_download_failed');
}

type InterruptedSession = { id: string; attachmentIds: string[] };

function createInterruptedSession(): InterruptedSession {
  const session = { id: crypto.randomUUID(), attachmentIds: [] };
  persistInterruptedSession(session);
  return session;
}

function persistInterruptedSession(session: InterruptedSession) {
  localStorage.setItem(INTERRUPTED_TASK_KEY, JSON.stringify(session));
}

function readInterruptedSession(): InterruptedSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(INTERRUPTED_TASK_KEY) || 'null');
    return value && Array.isArray(value.attachmentIds) ? value : null;
  } catch {
    return null;
  }
}

function clearInterruptedSession() {
  localStorage.removeItem(INTERRUPTED_TASK_KEY);
}

function removeBoundIds(session: InterruptedSession, notes: ImportRecord[]) {
  const bound = new Set(
    notes.flatMap((note) =>
      (note.attachments ?? []).map((attachment: ImportRecord) => attachment.id)
    )
  );
  session.attachmentIds = session.attachmentIds.filter((id) => !bound.has(id));
  persistInterruptedSession(session);
}

function removeAttachmentIds(session: InterruptedSession, ids: string[]) {
  const removed = new Set(ids);
  session.attachmentIds = session.attachmentIds.filter((id) => !removed.has(id));
  persistInterruptedSession(session);
}

async function cleanupAttachmentIds(ids: string[]) {
  for (const chunk of chunkValues([...new Set(ids)], 100)) {
    if (chunk.length > 0) await del('/attachments', { data: { ids: chunk } });
  }
}

function emptyResult(unchanged: number): ImportTaskResult {
  return {
    notes: { total: unchanged, created: 0, updated: 0, unchanged },
    articles: { total: 0, created: 0, updated: 0 },
    attachments: { total: 0, created: 0, updated: 0, deleted: 0, failed: 0 },
    skippedAfterAttachmentFailure: 0,
    failures: [],
  };
}

function mergeResult(target: ImportTaskResult, value: ImportTaskResult) {
  (['total', 'created', 'updated', 'unchanged'] as const).forEach((key) => {
    target.notes[key] += value.notes[key];
  });
  (['total', 'created', 'updated'] as const).forEach((key) => {
    target.articles[key] += value.articles[key];
  });
  (['total', 'created', 'updated', 'deleted'] as const).forEach((key) => {
    target.attachments[key] += value.attachments[key];
  });
}

function isVideoAttachment(attachment: ImportRecord) {
  const type = String(attachment.details?.mimetype || '');
  return type.startsWith('video/') || Boolean(attachment.details?.pairedVideoUrl);
}

function attachmentName(attachment: ImportRecord, index: number) {
  return String(attachment.details?.originalname || attachment.details?.key || `#${index + 1}`);
}

function hasContent(note: ImportRecord) {
  return typeof note.content === 'string' && note.content.trim().length > 0;
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    chunks.push(values.slice(index, index + size));
  return chunks;
}
