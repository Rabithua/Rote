import type { Attachment } from '@/types/main';
import { post, put } from '@/utils/api';
import { uploadToSignedUrl, type FinalizeAttachment, type PresignItem } from '@/utils/directUpload';
import { runConcurrency } from '@/utils/uploadHelpers';
import { noteFileManifest, prepareNoteFiles, type PreparedNoteFile } from './preparedNoteFiles';

type Part = 'original' | 'compressed' | 'poster';
type SignedBatch = { items: PresignItem[]; reservationId?: string; expiresAt?: string };
type BatchResult = { attachments: Attachment[] };

/** One selection and batch identity; an ordinary resubmit cannot bind it twice. */
export class NoteAttachmentBatch {
  readonly id = crypto.randomUUID();
  private prepared?: PreparedNoteFile[];
  private signed?: SignedBatch;
  private completed = new Map<File, Set<Part>>();
  private finalized?: Attachment[];
  private finalizeStarted = false;
  private readonly selection: (File | Attachment)[];
  private readonly browserDirectUpload: boolean;
  private readonly batchFinalize: boolean;

  constructor(
    selection: (File | Attachment)[],
    browserDirectUpload: boolean,
    batchFinalize: boolean
  ) {
    this.selection = [...selection];
    this.browserDirectUpload = browserDirectUpload;
    this.batchFinalize = batchFinalize;
  }

  async upload(noteId: string, onProgress: (file: File, progress: number) => void) {
    if (this.finalized) return this.finalized;
    this.prepared ??= await prepareNoteFiles(
      this.selection.filter((item): item is File => item instanceof File)
    );
    // Owner-locked policy (2026-09-11): propagate failures to the ordinary
    // editor error toast. Only an explicit resubmit refreshes expired credentials;
    // do not add automatic retries, cancellation or recovery modes without owner approval.
    if (
      !this.finalizeStarted &&
      this.signed?.reservationId &&
      this.signed.expiresAt &&
      Date.parse(this.signed.expiresAt) <= Date.now()
    ) {
      this.signed = (
        await post<{ data: SignedBatch }>(
          `/attachments/reservations/${this.signed.reservationId}/refresh`,
          {}
        )
      ).data;
    }
    this.signed ??= (
      await post<{ data: SignedBatch }>('/attachments/presign', {
        files: this.prepared.map(noteFileManifest),
        ...(this.browserDirectUpload ? { browserDirectUpload: true } : {}),
      })
    ).data;
    const signed = this.signed;
    if (
      signed.items.length !== this.prepared.length ||
      this.prepared.some(
        (item, index) =>
          !signed.items[index]?.original ||
          (item.compressed && !signed.items[index]?.compressed) ||
          (item.poster && !signed.items[index]?.poster)
      )
    ) {
      throw new Error('resource_upload_manifest_mismatch');
    }
    const results = await runConcurrency(this.prepared, async (item, index) => {
      const info = signed.items[index];
      const uploaded = this.completed.get(item.file) ?? new Set<Part>();
      this.completed.set(item.file, uploaded);
      const parts: [Part, Blob | null][] = [
        ['original', item.file],
        ['compressed', item.compressed],
        ['poster', item.poster],
      ];
      const total = parts.reduce((sum, [, blob]) => sum + (blob?.size ?? 0), 0);
      let transferred = 0;
      for (const [part, blob] of parts) {
        if (!blob) continue;
        if (!uploaded.has(part)) {
          await uploadToSignedUrl(info[part]!.putUrl, blob, (progress) =>
            onProgress(
              item.file,
              Math.round(((transferred + (blob.size * progress) / 100) / total) * 100)
            )
          );
          uploaded.add(part);
        }
        transferred += blob.size;
      }
      onProgress(item.file, 100);
    });
    const failed = results.find((result) => !result.success);
    if (failed) throw failed.error;
    const attachments = this.prepared.map((item, index) => {
      const info = signed.items[index];
      const uploaded = this.completed.get(item.file)!;
      return {
        clientId: item.clientId,
        uuid: info.uuid,
        originalKey: info.original.key,
        compressedKey: uploaded.has('compressed') ? info.compressed?.key : undefined,
        posterKey: uploaded.has('poster') ? info.poster?.key : undefined,
        size: item.file.size,
        mimetype: item.file.type,
      };
    });
    const clientIds = new Map(this.prepared.map((item) => [item.file, item.clientId]));
    const order = this.selection.map((item) =>
      item instanceof File ? { clientId: clientIds.get(item)! } : { attachmentId: item.id }
    );
    this.finalizeStarted = true;
    if (this.batchFinalize) {
      const response = await post<{ data: BatchResult }>('/attachments/finalize-batch', {
        batchId: this.id,
        reservationId: signed.reservationId,
        noteId,
        attachments,
        order,
      });
      this.finalized = response.data.attachments;
    } else {
      this.finalized = await this.finalizeUnmanaged(noteId, attachments);
    }
    return this.finalized;
  }

  matchesSelection(selection: (File | Attachment)[]) {
    return (
      selection.length === this.selection.length &&
      selection.every((item, index) => item === this.selection[index])
    );
  }

  get needsConfirmation() {
    return this.finalizeStarted;
  }

  get confirmedFiles(): [File, Attachment][] {
    return this.selection.flatMap((item, index) =>
      item instanceof File && this.finalized ? [[item, this.finalized[index]]] : []
    );
  }

  // Non-managed self-hosted storage has no reservation or finalize-batch endpoint.
  private async finalizeUnmanaged(noteId: string, attachments: FinalizeAttachment[]) {
    const { data } = await post<{ data: Attachment[] }>('/attachments/finalize', {
      noteId,
      attachments,
    });
    const byFile = new Map(this.prepared!.map((item, index) => [item.file, data[index]]));
    const ordered = this.selection.map((item) => (item instanceof File ? byFile.get(item)! : item));
    await put('/attachments/sort', {
      roteId: noteId,
      attachmentIds: ordered.map((item) => item.id),
    });
    return ordered;
  }
}
