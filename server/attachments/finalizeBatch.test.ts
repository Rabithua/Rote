import { describe, expect, it } from 'bun:test';
import type { FinalizeAttachmentBatchInput } from './types';

process.env.POSTGRESQL_URL ||= 'postgres://test:test@localhost:5432/rote_test';
const {
  assertAttachmentBindingAllowed,
  assertFinalizeAttachmentBatchInput,
  finalizeAttachmentBatch,
} = await import('./finalizeBatch');

const input = (): FinalizeAttachmentBatchInput => ({
  attachments: [
    {
      clientId: '11111111-1111-4111-8111-111111111111',
      mimetype: 'image/jpeg',
      originalKey: 'users/user/uploads/one.jpg',
      size: 10,
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    },
    {
      clientId: '22222222-2222-4222-8222-222222222222',
      mimetype: 'image/jpeg',
      originalKey: 'users/user/uploads/two.jpg',
      size: 20,
      uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    },
  ],
  batchId: '33333333-3333-4333-8333-333333333333',
  noteId: '44444444-4444-4444-8444-444444444444',
  order: [
    { attachmentId: '55555555-5555-4555-8555-555555555555' },
    { clientId: '11111111-1111-4111-8111-111111111111' },
    { clientId: '22222222-2222-4222-8222-222222222222' },
  ],
});

describe('attachment batch finalize contract', () => {
  it('accepts a complete mixed existing and new attachment order', () => {
    expect(() => assertFinalizeAttachmentBatchInput(input())).not.toThrow();
  });

  it('rejects a batch that omits a new attachment from the final order', () => {
    const value = input();
    value.order = value.order.slice(0, 2);
    expect(() => assertFinalizeAttachmentBatchInput(value)).toThrow('attachment_batch_invalid');
  });

  it('rejects duplicate client identities before any object or database work', () => {
    const value = input();
    value.attachments[1].clientId = value.attachments[0].clientId;
    expect(() => assertFinalizeAttachmentBatchInput(value)).toThrow('attachment_batch_invalid');
  });

  it('rejects an order reference containing both identity forms', () => {
    const value = input();
    value.order[0] = {
      attachmentId: '55555555-5555-4555-8555-555555555555',
      clientId: '11111111-1111-4111-8111-111111111111',
    } as never;
    expect(() => assertFinalizeAttachmentBatchInput(value)).toThrow('attachment_batch_invalid');
  });

  it('requires a managed reservation instead of offering non-idempotent batch finalize', async () => {
    await expect(
      finalizeAttachmentBatch({ input: input(), scopes: [], userId: 'user' })
    ).rejects.toMatchObject({ code: 'resource_upload_manifest_mismatch', status: 409 });
  });

  it('never rebinds an upload that already belongs to another note', () => {
    expect(() => assertAttachmentBindingAllowed(null, 'note-a')).not.toThrow();
    expect(() => assertAttachmentBindingAllowed('note-a', 'note-a')).not.toThrow();
    expect(() => assertAttachmentBindingAllowed('note-b', 'note-a')).toThrow(
      'resource_upload_manifest_mismatch'
    );
  });
});
