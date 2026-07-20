import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import type { ImportTaskProgress, ImportTaskResult } from '@/features/import/importTask';
import type { ReactNode } from 'react';
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
  const attachmentPercent = progress.attachmentsTotal
    ? Math.round((progress.attachmentsCompleted / progress.attachmentsTotal) * 100)
    : progress.stage === 'planning'
      ? 0
      : 100;
  const notePercent = progress.notesTotal
    ? Math.round((progress.notesCompleted / progress.notesTotal) * 100)
    : 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{result ? t('completeTitle') : t(`stages.${progress.stage}`)}</DialogTitle>
        <DialogDescription>{result ? t('completeDescription') : t('stayOnPage')}</DialogDescription>
      </DialogHeader>
      <div className="space-y-5">
        <ProgressSection
          label={t('attachments')}
          completed={progress.attachmentsCompleted}
          total={progress.attachmentsTotal}
          value={attachmentPercent}
          footer={
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>{t('active', { count: progress.attachmentsActive })}</span>
              <span>{t('failed', { count: progress.attachmentsFailed })}</span>
            </div>
          }
        />
        <ProgressSection
          label={t('notes')}
          completed={progress.notesCompleted}
          total={progress.notesTotal}
          value={notePercent}
        />
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

function ProgressSection({
  label,
  completed,
  total,
  value,
  footer,
}: {
  label: string;
  completed: number;
  total: number;
  value: number;
  footer?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {completed} / {total}
        </span>
      </div>
      <Progress value={value} />
      {footer}
    </div>
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
