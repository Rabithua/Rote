import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ImportTaskProgress, ImportTaskResult } from '@/features/import/importTask';
import { useTranslation } from 'react-i18next';

interface ImportTaskViewProps {
  progress: ImportTaskProgress;
  result: ImportTaskResult | null;
  onCancel: () => void;
  onDone: () => void;
}

export function ImportTaskView({ progress, result, onCancel, onDone }: ImportTaskViewProps) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.experiment.importData.importTask',
  });
  return (
    <>
      <DialogHeader>
        <DialogTitle>{result ? t('completeTitle') : t(`stages.${progress.stage}`)}</DialogTitle>
        <DialogDescription>{result ? t('completeDescription') : t('stayOnPage')}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        {!result && (
          <div
            className="text-muted-foreground flex flex-wrap gap-x-2 gap-y-1 text-xs tabular-nums"
            aria-live="polite"
          >
            <span>
              {t('attachments')} {progress.attachmentsCompleted}/{progress.attachmentsTotal}
            </span>
            <span aria-hidden="true">·</span>
            <span>{t('active', { count: progress.attachmentsActive })}</span>
            {progress.attachmentsFailed > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{t('failed', { count: progress.attachmentsFailed })}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>
              {t('notes')} {progress.notesCompleted}/{progress.notesTotal}
            </span>
          </div>
        )}
        {result && <ImportResultSummary result={result} />}
      </div>
      <DialogFooter>
        {result ? (
          <Button onClick={onDone}>{t('done')}</Button>
        ) : (
          <Button variant="outline" onClick={onCancel}>
            {t('cancel')}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function ImportResultSummary({ result }: { result: ImportTaskResult }) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.experiment.importData.importTask',
  });
  return (
    <div className="border-border space-y-2 border-t pt-4 text-sm">
      <div>{t('resultNotes', result.notes)}</div>
      <div>
        {t('resultAttachments', {
          success: result.attachments.created + result.attachments.updated,
          failed: result.attachments.failed,
        })}
      </div>
      {result.skippedAfterAttachmentFailure > 0 && (
        <div>{t('resultSkippedNotes', { count: result.skippedAfterAttachmentFailure })}</div>
      )}
      {result.failures.length > 0 && (
        <div className="max-h-32 overflow-y-auto border p-2 text-xs">
          {result.failures.map((failure, index) => (
            <div key={`${failure.noteTitle}-${failure.attachmentName}-${index}`}>
              {t('failureItem', {
                ...failure,
                reason: t(`errors.${failure.reason}`, { defaultValue: failure.reason }),
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
