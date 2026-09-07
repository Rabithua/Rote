import type { Attachment } from '@/types/main';
import { post, put } from '@/utils/api';
import {
  cancelUploadReservation,
  getResourceUploadErrorCode,
  uploadToSignedUrl,
  type FinalizeAttachment,
  type PresignItem,
} from '@/utils/directUpload';
import { runConcurrency } from '@/utils/uploadHelpers';
import { noteFileManifest, prepareNoteFiles, type PreparedNoteFile } from './preparedNoteFiles';

type Part = 'original' | 'compressed' | 'poster';
type SignedBatch = { items: PresignItem[]; reservationId?: string };
type BatchResult = { attachments: Attachment[] };

/** One immutable selection; retries retain the reservation and each completed object. */
export class NoteAttachmentBatch {
  readonly id = crypto.randomUUID();
  private prepared?: PreparedNoteFile[];
  private signed?: SignedBatch;
  private completed = new Map<File, Set<Part>>();
  private finalized?: Attachment[];
  private needsRefresh = false;
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
    try {
      await this.sign();
      const signed = this.signed!;
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
    } catch (error) {
      const code = getResourceUploadErrorCode(error);
      if (
        code === 'resource_upload_reservation_expired' ||
        code === 'resource_upload_manifest_mismatch'
      ) {
        this.signed = undefined;
        this.completed.clear();
      } else {
        this.needsRefresh = true;
      }
      throw error;
    }
  }

  private async sign() {
    if (this.signed && this.needsRefresh) {
      // Completed transfers only need a finalize replay, not fresh write credentials.
      const transferred = this.prepared!.every((item) => {
        const done = this.completed.get(item.file);
        return (
          done?.has('original') &&
          (!item.compressed || done.has('compressed')) &&
          (!item.poster || done.has('poster'))
        );
      });
      if (!transferred) {
        if (this.signed.reservationId) {
          const { data } = await post<{ data: SignedBatch }>(
            `/attachments/reservations/${this.signed.reservationId}/refresh`
          );
          const byUUID = new Map(data.items.map((item) => [item.uuid, item]));
          this.signed = { ...data, items: this.signed.items.map((item) => byUUID.get(item.uuid)!) };
        } else {
          this.signed = undefined;
          this.completed.clear();
        }
      }
    }
    if (!this.signed) {
      const { data } = await post<{ data: SignedBatch }>('/attachments/presign', {
        files: this.prepared!.map(noteFileManifest),
        ...(this.browserDirectUpload ? { browserDirectUpload: true } : {}),
      });
      this.signed = data;
    }
    if (
      this.signed.items.length !== this.prepared!.length ||
      this.prepared!.some((item, index) => {
        const info = this.signed!.items[index];
        return (
          !info?.original || (item.compressed && !info.compressed) || (item.poster && !info.poster)
        );
      })
    ) {
      throw new Error('resource_upload_manifest_mismatch');
    }
    this.needsRefresh = false;
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

  async cancel() {
    if (this.signed?.reservationId) await cancelUploadReservation(this.signed.reservationId);
  }
}
