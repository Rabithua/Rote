import NoteExportCard from '@/components/rote/NoteExportCard';
import type { Attachment } from '@/types/main';
import {
  captureElementToPng,
  cleanupOffscreenContainers,
  calculateScale,
  downloadBlob,
  logExport,
  logExportError,
  toDataURL,
  waitForImagesToLoad,
} from '@/utils/exportImage';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface Author {
  nickname?: string;
  avatar?: string;
  username?: string;
}

interface UseNoteExportOptions {
  title?: string;
  content: string;
  noteId?: string;
  author?: Author;
  tags?: string[];
  attachments?: Attachment[];
  articleTitle?: string;
}

export function useNoteExport() {
  const [exporting, setExporting] = useState(false);
  const { t } = useTranslation('translation', { keyPrefix: 'components.roteItem' });

  const handleExportImage = async ({
    title,
    content,
    noteId,
    author,
    tags,
    attachments,
    articleTitle,
  }: UseNoteExportOptions) => {
    const exportId = Math.random().toString(36).slice(2, 8);

    if (!content && (!attachments || attachments.length === 0)) return;
    if (exporting) return;

    setExporting(true);

    try {
      logExport(`[${exportId}] Start`, {
        title: title?.slice(0, 40),
        contentLength: content.length,
        tags: tags?.length,
      });

      let resolvedAuthor = author;
      if (author?.avatar) {
        try {
          resolvedAuthor = { ...author, avatar: await toDataURL(author.avatar) };
        } catch {
          resolvedAuthor = { ...author, avatar: '/DefaultAvatar.svg' };
        }
      }

      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(container);

      const root = createRoot(container);
      await new Promise<void>((resolve) => {
        root.render(
          <NoteExportCard
            title={title}
            content={content}
            noteId={noteId}
            tags={tags}
            attachments={attachments}
            articleTitle={articleTitle}
            author={resolvedAuthor}
            onReady={resolve}
          />
        );
      });

      const cardEl = container.firstElementChild as HTMLElement;
      if (!cardEl) throw new Error('Card not rendered');

      await new Promise((r) => setTimeout(r, 100));
      await waitForImagesToLoad(cardEl);

      const rect = cardEl.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const scale = calculateScale(rect.width, rect.height);

      logExport(`[${exportId}] Capturing`, {
        size: `${rect.width}x${rect.height}`,
        dpr,
        scale,
        outputPixels: `${rect.width * scale}x${rect.height * scale}`,
      });

      const blob = await captureElementToPng(cardEl, scale);
      downloadBlob(blob, `${title || 'note'}.png`);

      logExport(`[${exportId}] Done`, { sizeKB: (blob.size / 1024).toFixed(0) });
      toast.success(t('exportSuccess'));
    } catch (e) {
      logExportError(`[${exportId}] Failed`, e);
      toast.error(t('exportFailed'));
    } finally {
      cleanupOffscreenContainers();
      setExporting(false);
    }
  };

  return { exporting, handleExportImage };
}
