import type { Attachment } from '@/types/main';
import { describe, expect, it } from 'vitest';
import { emptyRote, sanitizeStoredEditorDraft } from '../editor';

const uploadedAttachment: Attachment = {
  id: 'attachment-1',
  url: 'https://example.test/users/1/uploads/a.jpg',
  compressUrl: '',
  userid: 'user-1',
  roteid: null,
  sortIndex: 0,
  storage: 'R2',
  details: { key: 'users/1/uploads/a.jpg' },
  createdAt: '2026-08-13T00:00:00.000Z',
  updatedAt: '2026-08-13T00:00:00.000Z',
};

describe('sanitizeStoredEditorDraft', () => {
  it('keeps uploaded attachments but omits browser Files and stale JSON placeholders', () => {
    const localFile = new File(['draft'], 'draft.jpg', { type: 'image/jpeg' });
    const draft = {
      ...emptyRote,
      attachments: [uploadedAttachment, localFile, {} as Attachment],
    };

    expect(sanitizeStoredEditorDraft(draft).attachments).toEqual([uploadedAttachment]);
    expect(draft.attachments).toHaveLength(3);
  });

  it('repairs a legacy draft without a valid attachments array', () => {
    const legacyDraft = { ...emptyRote, attachments: null } as unknown as typeof emptyRote;

    expect(sanitizeStoredEditorDraft(legacyDraft).attachments).toEqual([]);
  });
});
