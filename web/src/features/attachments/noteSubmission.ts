import type { Attachment, Rote } from '@/types/main';
import { del, post, put } from '@/utils/api';
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

/** Remote note identity is committed before starting any attachment requests. */
export class NoteSubmission {
  private note?: Rote;
  private batch?: NoteAttachmentBatch;
  private submittedFields?: string;
  private uploaded = new Map<File, Attachment>();

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
    const currentSelection = () =>
      draft.attachments.map((item) =>
        item instanceof File ? (this.uploaded.get(item) ?? item) : item
      );
    let selection = currentSelection();
    if (this.batch && !this.batch.matchesSelection(selection)) {
      // Owner-locked fast flow: a lost response can still mean a committed batch.
      // Resolve its database result before replacing it; never probe stored files
      // or add recovery UI here without explicit owner approval.
      if (this.batch.needsConfirmation) {
        await this.batch.upload(note.id, onProgress);
        for (const [file, attachment] of this.batch.confirmedFiles) {
          this.uploaded.set(file, attachment);
        }
        selection = currentSelection();
      }
      this.batch = undefined;
    }
    for (const [file, attachment] of this.uploaded) {
      if (!selection.some((item) => !(item instanceof File) && item.id === attachment.id)) {
        await del(`/attachments/${attachment.id}`);
        this.uploaded.delete(file);
      }
    }
    if (selection.some((item) => item instanceof File)) {
      if (!this.batch) {
        this.batch = new NoteAttachmentBatch(
          selection,
          capabilities.browserDirectUpload,
          capabilities.batchFinalize
        );
      }
      note.attachments = await this.batch.upload(note.id, onProgress);
    } else {
      if (selection.length) {
        await put('/attachments/sort', {
          roteId: note.id,
          attachmentIds: (selection as Attachment[]).map((item) => item.id),
        });
      }
      note.attachments = selection;
    }
    return note;
  }
}
