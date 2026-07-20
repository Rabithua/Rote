import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import ImportPreviewDialog from './ImportPreviewDialog';

const preview = {
  fileName: 'memos.json',
  articleCount: 0,
  roteCount: 1,
  attachmentCount: 3,
  publicCount: 0,
  privateCount: 1,
  tagCount: 0,
  smartImportCount: 1,
  rotes: [],
};

function renderDialog(overrides: Record<string, unknown> = {}) {
  const onRequestCancel = vi.fn();
  render(
    <ImportPreviewDialog
      excludedIndexes={new Set()}
      isImporting
      onChooseAnother={vi.fn()}
      onConfirm={vi.fn()}
      onOpenChange={vi.fn()}
      onToggleExclude={vi.fn()}
      onOverwriteExistingChange={vi.fn()}
      onPreserveVisibilityChange={vi.fn()}
      open
      overwriteExisting={false}
      preserveVisibility={false}
      preview={preview}
      taskProgress={{
        stage: 'migrating',
        notesCompleted: 0,
        notesTotal: 1,
        attachmentsActive: 2,
        attachmentsCompleted: 1,
        attachmentsFailed: 1,
        attachmentsTotal: 3,
      }}
      taskResult={null}
      onRequestCancel={onRequestCancel}
      {...overrides}
    />
  );
  return { onRequestCancel };
}

describe('ImportPreviewDialog progress', () => {
  test('shows real attachment progress and requests explicit cancellation', () => {
    const { onRequestCancel } = renderDialog();

    const progressbars = screen.getAllByRole('progressbar');
    expect(progressbars).toHaveLength(2);
    expect(progressbars.map((progressbar) => progressbar.getAttribute('aria-valuenow'))).toEqual([
      '33',
      '0',
    ]);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('stayOnPage')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(onRequestCancel).toHaveBeenCalledOnce();
  });

  test('lists discarded attachments after completion', () => {
    renderDialog({
      isImporting: false,
      taskProgress: {
        stage: 'completed',
        notesCompleted: 1,
        notesTotal: 1,
        attachmentsActive: 0,
        attachmentsCompleted: 3,
        attachmentsFailed: 1,
        attachmentsTotal: 3,
      },
      taskResult: {
        notes: { total: 1, created: 1, updated: 0, unchanged: 0 },
        articles: { total: 0, created: 0, updated: 0 },
        attachments: { total: 2, created: 2, updated: 0, deleted: 0, failed: 1 },
        skippedAfterAttachmentFailure: 0,
        failures: [
          {
            attachmentName: 'broken.png',
            noteTitle: 'Example',
            provider: 'memos',
            reason: 'remote_attachment_download_failed',
          },
        ],
      },
    });

    expect(screen.getByText('resultAttachments')).toBeInTheDocument();
    expect(screen.getByText('failureItem')).toBeInTheDocument();
  });
});
