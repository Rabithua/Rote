import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment, Rote } from '@/types/main';
import { emptyRote } from '@/state/editor';
import { get, post, put } from '@/utils/api';
import { cancelUploadReservation, uploadToSignedUrl } from '@/utils/directUpload';
import { NoteSubmission } from './noteSubmission';

vi.mock('@/utils/api', () => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('@/utils/directUpload', async (original) => ({
  ...(await original<typeof import('@/utils/directUpload')>()),
  uploadToSignedUrl: vi.fn(),
  cancelUploadReservation: vi.fn(),
}));
vi.mock('@/utils/generateVideoPoster', () => ({
  generateVideoPoster: vi.fn(async () => new Blob(['poster'], { type: 'image/jpeg' })),
}));
vi.mock('@/utils/uploadHelpers', async (original) => ({
  ...(await original<typeof import('@/utils/uploadHelpers')>()),
  maybeCompressToWebp: vi.fn(async (file: File) =>
    file.type.startsWith('image/') ? new Blob(['preview'], { type: 'image/webp' }) : null
  ),
}));

const capabilities = { browserDirectUpload: true, batchFinalize: true };
const createId = '11111111-1111-4111-8111-111111111111';
const existing = { id: 'existing', roteid: createId } as Attachment;
let events: string[];
let saved: Rote;
let signed: { reservationId: string; items: any[] };
let failUpload: string | undefined;
let loseCreate: boolean;
let loseFinalize: boolean;
let presigns: number;

beforeEach(() => {
  vi.clearAllMocks();
  events = [];
  failUpload = undefined;
  loseCreate = loseFinalize = false;
  presigns = 0;
  saved = { ...emptyRote, id: createId, content: 'note' };
  vi.mocked(post).mockImplementation(async (url, body) => {
    events.push(url);
    if (url === '/notes') {
      if (loseCreate) {
        loseCreate = false;
        throw new Error('response lost');
      }
      saved = { ...saved, ...body, articleId: body.articleId ?? null, attachments: [] };
      return { data: saved };
    }
    if (url === '/attachments/presign') {
      presigns++;
      signed = {
        reservationId: `reservation-${presigns}`,
        items: body.files.map((file: any, index: number) => ({
          uuid: `uuid-${presigns}-${index}`,
          original: {
            key: `original-${presigns}-${index}`,
            putUrl: `https://cos.test/original-${presigns}-${index}`,
          },
          ...(file.compressed
            ? {
                compressed: {
                  key: `compressed-${presigns}-${index}`,
                  putUrl: `https://cos.test/compressed-${presigns}-${index}`,
                },
              }
            : {}),
          ...(file.poster
            ? {
                poster: {
                  key: `poster-${presigns}-${index}`,
                  putUrl: `https://cos.test/poster-${presigns}-${index}`,
                },
              }
            : {}),
        })),
      };
      return { data: signed };
    }
    if (url.endsWith('/refresh')) return { data: signed };
    if (url === '/attachments/finalize-batch') {
      if (loseFinalize) {
        loseFinalize = false;
        throw new Error('response lost');
      }
      return {
        data: {
          attachments: body.order.map((ref: any) => ({
            id: ref.attachmentId ?? ref.clientId,
            roteid: body.noteId,
          })),
          clientIdMap: {},
        },
      };
    }
    if (url === '/attachments/finalize')
      return {
        data: body.attachments.map((item: any) => ({ id: item.uuid, roteid: body.noteId })),
      };
    throw new Error(`unexpected request ${url}`);
  });
  vi.mocked(put).mockImplementation(async (url, body) => {
    events.push(url);
    return { data: { ...saved, ...body } };
  });
  vi.mocked(get).mockImplementation(async () => ({ data: { ...saved, attachments: [existing] } }));
  vi.mocked(uploadToSignedUrl).mockImplementation(async (url) => {
    events.push(url);
    if (failUpload && url.includes(failUpload)) {
      failUpload = undefined;
      throw new Error('offline');
    }
  });
});

function draft(files: (File | Attachment)[] = []) {
  return { ...emptyRote, content: 'note', attachments: files };
}
const photo = () => new File(['original'], 'image.jpg', { type: 'image/jpeg' });
const submit = (session: NoteSubmission, note: Rote) =>
  session.submit(note, createId, capabilities, vi.fn(), vi.fn());

describe('note-first attachment submission', () => {
  it('saves identity before signing, uploads every part and binds the ordered batch', async () => {
    const onSaved = vi.fn(() => events.push('saved identity'));
    const session = new NoteSubmission();
    await session.submit(draft([photo(), photo()]), createId, capabilities, onSaved, vi.fn());
    expect(events.slice(0, 3)).toEqual(['/notes', 'saved identity', '/attachments/presign']);
    expect(events.at(-1)).toBe('/attachments/finalize-batch');
    expect(vi.mocked(uploadToSignedUrl)).toHaveBeenCalledTimes(4);
    const [, body] = vi
      .mocked(post)
      .mock.calls.find(([url]) => url === '/attachments/finalize-batch')!;
    expect(body.noteId).toBe(createId);
    expect(body.reservationId).toBe('reservation-1');
    expect(body.order.map((ref: any) => ref.clientId)).toEqual(
      body.attachments.map((item: any) => item.clientId)
    );
  });

  it('does not upload or create a second identity when the create response is lost', async () => {
    loseCreate = true;
    const session = new NoteSubmission();
    const note = draft([photo()]);
    await expect(submit(session, note)).rejects.toThrow('response lost');
    expect(events).toEqual(['/notes']);
    await submit(session, note);
    const calls = vi.mocked(post).mock.calls.filter(([url]) => url === '/notes');
    expect(calls.map((call) => call[2]?.headers?.['Idempotency-Key'])).toEqual([
      createId,
      createId,
    ]);
  });

  it('retains the saved note and transferred parts after a failed preview upload', async () => {
    const session = new NoteSubmission();
    const note = draft([photo()]);
    failUpload = 'compressed';
    await expect(submit(session, note)).rejects.toThrow('offline');
    expect(events).not.toContain('/attachments/finalize-batch');
    await submit(session, note);
    expect(events.filter((event) => event === '/notes')).toHaveLength(1);
    expect(events.filter((event) => event.includes('cos.test/original'))).toHaveLength(1);
    expect(events).toContain('/attachments/reservations/reservation-1/refresh');
    expect(cancelUploadReservation).not.toHaveBeenCalled();
  });

  it('replays only finalize with the same batch and client IDs after a lost result', async () => {
    const session = new NoteSubmission();
    const note = draft([photo()]);
    loseFinalize = true;
    await expect(submit(session, note)).rejects.toThrow('response lost');
    const before = events.length;
    await submit(session, note);
    expect(events.slice(before)).toEqual(['/attachments/finalize-batch']);
    const calls = vi
      .mocked(post)
      .mock.calls.filter(([url]) => url === '/attachments/finalize-batch');
    expect(calls[0][1]).toEqual(calls[1][1]);
  });

  it('does not finalize a partial batch and retains successful files across retry', async () => {
    const session = new NoteSubmission();
    const note = draft([photo(), photo()]);
    failUpload = 'original-1-0';
    await expect(submit(session, note)).rejects.toThrow('offline');
    expect(events).not.toContain('/attachments/finalize-batch');
    await submit(session, note);
    expect(events.filter((event) => event.endsWith('original-1-1'))).toHaveLength(1);
  });

  it('uses the existing note and sends existing and new attachments in display order', async () => {
    const note = { ...draft([existing, photo()]), id: createId };
    await submit(new NoteSubmission(), note);
    expect(events[0]).toBe(`/notes/${createId}`);
    expect(events).not.toContain('/notes');
    const [, body] = vi
      .mocked(post)
      .mock.calls.find(([url]) => url === '/attachments/finalize-batch')!;
    expect(body.order[0]).toEqual({ attachmentId: existing.id });
    expect(body.order[1]).toEqual({ clientId: body.attachments[0].clientId });
  });

  it('rejects signatures missing a declared preview instead of silently finalizing an original', async () => {
    const handler = vi.mocked(post).getMockImplementation()!;
    vi.mocked(post).mockImplementation(async (...args) => {
      const response = await handler(...args);
      if (args[0] === '/attachments/presign') delete signed.items[0].compressed;
      return response;
    });
    await expect(submit(new NoteSubmission(), draft([photo()]))).rejects.toThrow(
      'resource_upload_manifest_mismatch'
    );
    expect(uploadToSignedUrl).not.toHaveBeenCalled();
    expect(events).not.toContain('/attachments/finalize-batch');
    expect(cancelUploadReservation).toHaveBeenCalledWith('reservation-1');
  });

  it('updates edited text on the saved note while retrying the same attachment batch', async () => {
    const session = new NoteSubmission();
    const note = draft([photo()]);
    failUpload = 'compressed';
    await expect(submit(session, note)).rejects.toThrow('offline');
    await submit(session, { ...note, content: 'edited after failure' });
    expect(events.filter((event) => event === '/notes')).toHaveLength(1);
    expect(put).toHaveBeenCalledWith(
      `/notes/${createId}`,
      expect.objectContaining({
        content: 'edited after failure',
      })
    );
    expect(events.filter((event) => event.includes('cos.test/original'))).toHaveLength(1);
  });

  it('uploads the video and its client-generated poster directly', async () => {
    await submit(
      new NoteSubmission(),
      draft([new File(['video'], 'video.mp4', { type: 'video/mp4' })])
    );
    expect(events.filter((event) => event.startsWith('https://'))).toEqual([
      'https://cos.test/original-1-0',
      'https://cos.test/poster-1-0',
    ]);
  });

  it('creates a text-only note without attachment requests', async () => {
    await submit(new NoteSubmission(), draft());
    expect(events).toEqual(['/notes']);
  });

  it('uses explicit non-managed finalization on self-hosted storage', async () => {
    await new NoteSubmission().submit(
      draft([photo()]),
      createId,
      { browserDirectUpload: false, batchFinalize: false },
      vi.fn(),
      vi.fn()
    );
    expect(events).not.toContain('/attachments/finalize-batch');
    expect(events.slice(-2)).toEqual(['/attachments/finalize', '/attachments/sort']);
  });

  it('cancels only on explicit discard and reads attachments already bound by a lost finalize', async () => {
    const session = new NoteSubmission();
    loseFinalize = true;
    await expect(submit(session, draft([photo()]))).rejects.toThrow();
    expect(await session.discardAttachments(createId)).toEqual([existing]);
    expect(cancelUploadReservation).toHaveBeenCalledWith('reservation-1');
  });

  it('does not report attachments as discarded while finalization is still active', async () => {
    const session = new NoteSubmission();
    loseFinalize = true;
    await expect(submit(session, draft([photo()]))).rejects.toThrow();
    vi.mocked(cancelUploadReservation).mockRejectedValueOnce(
      new Error('attachment_batch_finalizing')
    );

    await expect(session.discardAttachments(createId)).rejects.toThrow(
      'attachment_batch_finalizing'
    );
    expect(get).not.toHaveBeenCalled();
  });
});
