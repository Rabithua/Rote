import type { Attachment, Rote } from '@/types/main';
import { get, post, put } from '@/utils/api';
import { NoteAttachmentBatch } from './noteAttachmentBatch';

function noteFields(note: Rote) {
  return {
    content: note.content.trim(),
    title: note.title ?? '',
    state: note.state,
    tags: note.tags,
    pin: note.pin,
    archived: note.archived,
    editor: note.editor ?? 'normal',
    articleId: note.articleId ?? null,
  };
}

export function isNoteDraftEmpty(note: Pick<Rote, 'content' | 'attachments'>): boolean {
  return note.content.trim().length === 0 && note.attachments.length === 0;
}

/** Remote note identity is committed before starting any attachment requests. */
export class NoteSubmission {
  private note?: Rote;
  private batch?: NoteAttachmentBatch;
  private submittedFields?: string;

  async submit(
    draft: Rote,
    createId: string,
    capabilities: { browserDirectUpload: boolean; batchFinalize: boolean },
    onNoteSaved: (note: Rote) => void,
    onProgress: (file: File, progress: number) => void
  ): Promise<Rote> {
    const fields = noteFields(draft);
    const serialized = JSON.stringify(fields);
    const id = this.note?.id || draft.id;
    if (!id) {
      const { data } = await post<{ data: Rote }>(
        '/notes',
        {
          ...fields,
          articleId: fields.articleId ?? undefined,
          attachmentIds: draft.attachments
            .filter((item): item is Attachment => !(item instanceof File) && !item.roteid)
            .map((item) => item.id),
        },
        { headers: { 'Idempotency-Key': createId } }
      );
      this.note = data;
      this.submittedFields = JSON.stringify(noteFields(data));
      onNoteSaved(data);
    }
    if (this.submittedFields !== serialized) {
      const { data } = await put<{ data: Rote }>(`/notes/${this.note?.id || id}`, fields);
      this.note = data;
      this.submittedFields = serialized;
      onNoteSaved(data);
    }
    const note = this.note!;
    if (draft.attachments.some((item) => item instanceof File)) {
      this.batch ??= new NoteAttachmentBatch(
        draft.attachments,
        capabilities.browserDirectUpload,
        capabilities.batchFinalize
      );
      note.attachments = await this.batch.upload(note.id, onProgress);
    } else if (draft.attachments.length) {
      await put('/attachments/sort', {
        roteId: note.id,
        attachmentIds: (draft.attachments as Attachment[]).map((item) => item.id),
      });
      note.attachments = draft.attachments;
    }
    return note;
  }

  async discardAttachments(noteId: string) {
    await this.batch?.cancel();
    // A lost finalize response may already have bound the batch. Read the actual result.
    const { data } = await get<{ data: Rote }>(`/notes/${noteId}`);
    this.batch = undefined;
    return data.attachments;
  }
}
