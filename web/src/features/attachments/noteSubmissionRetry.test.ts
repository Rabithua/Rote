import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment, Rote } from '@/types/main';
import { emptyRote } from '@/state/editor';
import { del, post, put } from '@/utils/api';
import { uploadToSignedUrl } from '@/utils/directUpload';
import { NoteSubmission } from './noteSubmission';

vi.mock('@/utils/api', () => ({ post: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('@/utils/directUpload', () => ({ uploadToSignedUrl: vi.fn() }));
vi.mock('@/utils/uploadHelpers', async (original) => ({
  ...(await original<typeof import('@/utils/uploadHelpers')>()),
  maybeCompressToWebp: vi.fn(async () => new Blob(['preview'], { type: 'image/webp' })),
}));

const noteId = 'note';
const capabilities = { browserDirectUpload: true, batchFinalize: true };
const photo = () => new File(['original'], 'image.jpg', { type: 'image/jpeg' });
const submit = (session: NoteSubmission, attachments: (File | Attachment)[]) =>
  session.submit(
    { ...emptyRote, content: 'note', attachments },
    noteId,
    capabilities,
    vi.fn(),
    vi.fn()
  );
let remote: Map<string, Attachment>;
let batches: Map<string, { attachments: Attachment[] }>;
let reservations: Map<string, any>;
let loseFinalize: boolean;
let failPart: string | undefined;

beforeEach(() => {
  vi.resetAllMocks();
  remote = new Map();
  batches = new Map();
  reservations = new Map();
  loseFinalize = false;
  failPart = undefined;
  vi.mocked(post).mockImplementation(async (url, body) => {
    if (url === '/notes') return { data: { ...emptyRote, ...body, id: noteId } as Rote };
    if (url === '/attachments/presign') {
      const reservationId = `reservation-${reservations.size}`;
      const signed = {
        reservationId,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        items: body.files.map((_: unknown, index: number) => ({
          uuid: `${reservationId}-${index}`,
          original: {
            key: `${reservationId}/${index}`,
            putUrl: `original/${reservationId}/${index}`,
          },
          compressed: {
            key: `${reservationId}/${index}/preview`,
            putUrl: `preview/${reservationId}/${index}`,
          },
        })),
      };
      reservations.set(reservationId, signed);
      return { data: signed };
    }
    if (url.endsWith('/refresh')) {
      const signed = reservations.get(url.split('/')[3]);
      return {
        data: {
          ...signed,
          expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
          items: signed.items.map((item: any) => ({
            ...item,
            original: { ...item.original, putUrl: `${item.original.putUrl}?fresh` },
            compressed: { ...item.compressed, putUrl: `${item.compressed.putUrl}?fresh` },
          })),
        },
      };
    }
    if (url === '/attachments/finalize-batch') {
      // Model a committed database transaction even when its HTTP response is lost.
      if (!batches.has(body.batchId)) {
        const added: Attachment[] = body.attachments.map((item: any) => ({
          id: item.clientId,
          roteid: noteId,
        }));
        const order = body.order.map((ref: any) => ref.attachmentId ?? ref.clientId);
        const bound = new Map<string, Attachment>([
          ...remote,
          ...added.map((item): [string, Attachment] => [item.id, item]),
        ]);
        if (bound.size !== order.length || [...bound.keys()].some((id) => !order.includes(id))) {
          throw new Error('409 attachment order mismatch');
        }
        remote = bound;
        batches.set(body.batchId, { attachments: order.map((id: string) => remote.get(id)!) });
      }
      if (loseFinalize) {
        loseFinalize = false;
        throw new Error('response lost');
      }
      return { data: batches.get(body.batchId) };
    }
    throw new Error(`unexpected request ${url}`);
  });
  vi.mocked(put).mockImplementation(async (url, body) => {
    if (url === '/attachments/sort') {
      expect([...remote.keys()].sort()).toEqual([...body.attachmentIds].sort());
    }
    return { data: { ...emptyRote, ...body, id: noteId } };
  });
  vi.mocked(del).mockImplementation(async (url) => {
    remote.delete(url.split('/').at(-1)!);
    return { data: null };
  });
  vi.mocked(uploadToSignedUrl).mockImplementation(async (url) => {
    if (failPart && url.startsWith(failPart)) {
      failPart = undefined;
      throw new Error('offline');
    }
  });
});

describe('ordinary attachment resubmission after failure', () => {
  it('refreshes expired credentials on resubmit and keeps already uploaded parts', async () => {
    const session = new NoteSubmission();
    const files = [photo()];
    failPart = 'preview';
    await expect(submit(session, files)).rejects.toThrow('offline');
    reservations.get('reservation-0').expiresAt = new Date(Date.now() - 1).toISOString();
    vi.mocked(uploadToSignedUrl).mockImplementation(async (url) => {
      if (!url.endsWith('?fresh')) throw new Error('403 expired signature');
    });
    await submit(session, files);
    expect(post).toHaveBeenCalledWith('/attachments/reservations/reservation-0/refresh', {});
    expect(uploadToSignedUrl).toHaveBeenCalledTimes(3);
    expect(uploadToSignedUrl).toHaveBeenLastCalledWith(
      'preview/reservation-0/0?fresh',
      expect.any(Blob),
      expect.any(Function)
    );
    expect(reservations.size).toBe(1);
    expect(remote.size).toBe(1);
  });

  it('does not refresh expired credentials when only confirmation remains', async () => {
    const session = new NoteSubmission();
    const files = [photo()];
    loseFinalize = true;
    await expect(submit(session, files)).rejects.toThrow('response lost');
    reservations.get('reservation-0').expiresAt = new Date(Date.now() - 1).toISOString();
    await submit(session, files);
    expect(vi.mocked(post).mock.calls.some(([url]) => url.endsWith('/refresh'))).toBe(false);
    expect(uploadToSignedUrl).toHaveBeenCalledTimes(2);
  });

  it('reorders a committed batch after a lost response without uploading it twice', async () => {
    const session = new NoteSubmission();
    const files = [photo(), photo()];
    loseFinalize = true;
    await expect(submit(session, files)).rejects.toThrow('response lost');
    const ids = [...remote.keys()];
    const result = await submit(session, [files[1], files[0]]);
    expect(result.attachments.map((item) => (item as Attachment).id)).toEqual(ids.reverse());
    expect(reservations.size).toBe(1);
    expect(batches.size).toBe(1);
    expect(uploadToSignedUrl).toHaveBeenCalledTimes(4);
  });

  it('actually removes all committed files when the user removes them after a lost response', async () => {
    const session = new NoteSubmission();
    loseFinalize = true;
    await expect(submit(session, [photo(), photo()])).rejects.toThrow('response lost');
    const result = await submit(session, []);
    expect(result.attachments).toEqual([]);
    expect(remote.size).toBe(0);
    expect(del).toHaveBeenCalledTimes(2);
    expect(reservations.size).toBe(1);
  });

  it('preserves the original batch if its confirmation response is lost again', async () => {
    const session = new NoteSubmission();
    loseFinalize = true;
    await expect(submit(session, [photo()])).rejects.toThrow('response lost');
    loseFinalize = true;
    await expect(submit(session, [])).rejects.toThrow('response lost');
    expect(del).not.toHaveBeenCalled();
    await submit(session, []);
    expect(remote.size).toBe(0);
    expect(batches.size).toBe(1);
  });

  it('can retry a lost deletion response without resurrecting removed attachments', async () => {
    const session = new NoteSubmission();
    loseFinalize = true;
    await expect(submit(session, [photo(), photo()])).rejects.toThrow('response lost');
    vi.mocked(del).mockImplementationOnce(async (url) => {
      remote.delete(url.split('/').at(-1)!);
      throw new Error('delete response lost');
    });
    await expect(submit(session, [])).rejects.toThrow('delete response lost');
    const result = await submit(session, []);
    expect(result.attachments).toEqual([]);
    expect(remote.size).toBe(0);
    expect(batches.size).toBe(1);
  });

  it('keeps retained file identities when a replacement upload also fails', async () => {
    const session = new NoteSubmission();
    const [retained, removed, added] = [photo(), photo(), photo()];
    loseFinalize = true;
    await expect(submit(session, [retained, removed])).rejects.toThrow('response lost');
    const retainedId = [...remote.keys()][0];
    failPart = 'preview';
    await expect(submit(session, [added, retained])).rejects.toThrow('offline');
    const result = await submit(session, [retained, added]);
    expect(result.attachments).toHaveLength(2);
    expect((result.attachments[0] as Attachment).id).toBe(retainedId);
    expect(remote.size).toBe(2);
    expect(del).toHaveBeenCalledTimes(1);
  });
});
