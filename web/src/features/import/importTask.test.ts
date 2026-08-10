import { beforeEach, describe, expect, test, vi } from 'vitest';
import { migrateWithRetry, runAttachmentQueue, runImportTask } from './importTask';

const { postMock, deleteMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('@/utils/api', () => ({ post: postMock, del: deleteMock }));

beforeEach(() => {
  postMock.mockReset();
  deleteMock.mockReset();
});

describe('import attachment queue', () => {
  test('uses eight total slots, no more than two videos, and refills immediately', async () => {
    const tasks = Array.from({ length: 30 }, (_, index) => ({
      index,
      video: index % 3 === 0,
    }));
    let active = 0;
    let activeVideos = 0;
    let peak = 0;
    let videoPeak = 0;
    let completed = 0;

    await runAttachmentQueue(tasks, new AbortController().signal, async (task) => {
      active += 1;
      if (task.video) activeVideos += 1;
      peak = Math.max(peak, active);
      videoPeak = Math.max(videoPeak, activeVideos);
      await Promise.resolve();
      completed += 1;
      active -= 1;
      if (task.video) activeVideos -= 1;
    });

    expect(peak).toBe(8);
    expect(videoPeak).toBe(2);
    expect(completed).toBe(30);
  });

  test('degrades the queue to four slots after a transient failure', async () => {
    const tasks = Array.from({ length: 16 }, (_, index) => ({ index, video: false }));
    const releases: Array<() => void> = [];
    let active = 0;
    let peakAfterDegrade = 0;

    const queue = runAttachmentQueue(tasks, new AbortController().signal, async (task, degrade) => {
      active += 1;
      await new Promise<void>((resolve) => releases.push(resolve));
      if (task.index === 0) {
        degrade();
      }
      active -= 1;
      if (task.index >= 8) peakAfterDegrade = Math.max(peakAfterDegrade, active + 1);
    });

    await vi.waitFor(() => expect(releases).toHaveLength(8));
    releases.splice(0, 8).forEach((release) => release());
    await vi.waitFor(() => expect(releases).toHaveLength(4));
    releases.splice(0, 4).forEach((release) => release());
    await vi.waitFor(() => expect(releases).toHaveLength(4));
    releases.splice(0, 4).forEach((release) => release());
    await queue;

    expect(peakAfterDegrade).toBeLessThanOrEqual(4);
  });

  test('retries one transient failure and does not retry permanent failures', async () => {
    const transient = vi
      .fn()
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValueOnce({ id: 'migrated' });
    const degrade = vi.fn();
    await expect(
      migrateWithRetry({}, new AbortController().signal, degrade, transient)
    ).resolves.toEqual({ id: 'migrated' });
    expect(transient).toHaveBeenCalledTimes(2);
    expect(degrade).toHaveBeenCalledOnce();

    const permanent = vi.fn().mockRejectedValue({ response: { status: 404 } });
    await expect(
      migrateWithRetry({}, new AbortController().signal, vi.fn(), permanent)
    ).rejects.toEqual({ response: { status: 404 } });
    expect(permanent).toHaveBeenCalledOnce();
  });

  test('skips an overwrite when any attachment fails and removes migrated temporary files', async () => {
    const noteId = crypto.randomUUID();
    postMock.mockImplementation(async (path: string, body: Record<string, unknown>) => {
      if (path === '/users/me/import/plan') return { data: { noteIndexes: [0] } };
      if (path === '/imports/attachments/migrate') {
        const migratedAttachment = body.attachment as { url: string };
        if (migratedAttachment.url.endsWith('/failed.png')) {
          throw {
            response: { status: 413, data: { message: 'remote_attachment_too_large' } },
          };
        }
        return { data: { id: 'migrated-attachment' } };
      }
      throw new Error('overwrite with a failed attachment must not be imported');
    });
    deleteMock.mockResolvedValue({});

    const result = await runImportTask({
      payload: {
        notes: [
          {
            id: noteId,
            content: 'existing memo',
            source: { provider: 'memos', accountId: 'account', externalId: 'memo-1' },
            attachments: [
              {
                url: 'https://memos.example.com/success.png',
                storage: 'REMOTE',
                details: { mimetype: 'image/png' },
                source: { provider: 'memos', accountId: 'account', externalId: 'asset-1' },
              },
              {
                url: 'https://memos.example.com/failed.png',
                storage: 'REMOTE',
                details: { mimetype: 'image/png' },
                source: { provider: 'memos', accountId: 'account', externalId: 'asset-2' },
              },
            ],
          },
        ],
      },
      overwriteExisting: true,
      preserveVisibility: false,
      signal: new AbortController().signal,
      onProgress: vi.fn(),
    });

    expect(postMock.mock.calls.filter(([path]) => path === '/users/me/import')).toHaveLength(0);
    expect(deleteMock).toHaveBeenCalledWith('/attachments', {
      data: { ids: ['migrated-attachment'] },
    });
    expect(result.skippedAfterAttachmentFailure).toBe(1);
    expect(result.failures).toEqual([
      expect.objectContaining({ reason: 'remote_attachment_too_large' }),
    ]);
  });

  test('still imports articles when every note is skipped by preflight', async () => {
    postMock.mockResolvedValueOnce({ data: { noteIndexes: [] } }).mockResolvedValueOnce({
      data: {
        notes: { total: 0, created: 0, updated: 0, unchanged: 0 },
        articles: { total: 1, created: 1, updated: 0 },
        attachments: { total: 0, created: 0, updated: 0, deleted: 0 },
      },
    });

    const result = await runImportTask({
      payload: {
        formatVersion: 2,
        notes: [],
        articles: [{ id: crypto.randomUUID(), content: 'article' }],
      },
      overwriteExisting: false,
      preserveVisibility: false,
      signal: new AbortController().signal,
      onProgress: vi.fn(),
    });

    expect(postMock).toHaveBeenCalledTimes(2);
    expect(postMock.mock.calls[1][1]).toMatchObject({
      notes: [],
      articles: [{ content: 'article' }],
    });
    expect(result.articles.created).toBe(1);
  });

  test('keeps Memos credentials in memory and sends them only with attachment migration', async () => {
    const noteId = crypto.randomUUID();
    postMock
      .mockResolvedValueOnce({ data: { noteIndexes: [0] } })
      .mockResolvedValueOnce({ data: { id: 'migrated-attachment' } })
      .mockResolvedValueOnce({
        data: {
          notes: { total: 1, created: 1, updated: 0, unchanged: 0 },
          articles: { total: 0, created: 0, updated: 0 },
          attachments: { total: 1, created: 1, updated: 0, deleted: 0 },
        },
      });

    await runImportTask({
      payload: {
        notes: [
          {
            id: noteId,
            content: 'memo',
            attachments: [
              {
                url: 'https://memos.example.com/file/attachments/a/photo.png',
                storage: 'REMOTE',
                details: { mimetype: 'image/png' },
              },
            ],
          },
        ],
      },
      overwriteExisting: false,
      preserveVisibility: false,
      signal: new AbortController().signal,
      onProgress: vi.fn(),
      migrationAuth: {
        provider: 'memos',
        baseUrl: 'https://memos.example.com',
        token: 'private-token',
      },
    });

    expect(postMock.mock.calls[1]).toMatchObject([
      '/imports/attachments/migrate',
      {
        migrationAuth: { provider: 'memos', baseUrl: 'https://memos.example.com' },
      },
      { headers: { 'x-memos-access-token': 'private-token' } },
    ]);
    expect(postMock.mock.calls[0][1]).not.toHaveProperty('migrationAuth');
    expect(postMock.mock.calls[2][1]).not.toHaveProperty('migrationAuth');
  });
});
