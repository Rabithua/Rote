import RoteList from '@/components/rote/roteList';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import type { Rotes } from '@/types/main';
import {
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  FileJson,
  Loader,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

export type ImportPreview = {
  fileName: string;
  articleCount: number;
  roteCount: number;
  attachmentCount: number;
  publicCount: number;
  privateCount: number;
  tagCount: number;
  smartImportCount: number;
  rotes: Rotes;
};

type ImportPreviewDialogProps = {
  excludedIndexes: Set<number>;
  isImporting: boolean;
  onChooseAnother: () => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  onToggleExclude: (index: number) => void;
  onOverwriteConflictsChange: (value: boolean) => void;
  onPreserveVisibilityChange: (value: boolean) => void;
  open: boolean;
  overwriteConflicts: boolean;
  preserveVisibility: boolean;
  preview: ImportPreview;
};

const PREVIEW_PAGE_SIZE = 10;

export default function ImportPreviewDialog({
  excludedIndexes,
  isImporting,
  onChooseAnother,
  onConfirm,
  onOpenChange,
  onToggleExclude,
  onOverwriteConflictsChange,
  onPreserveVisibilityChange,
  open,
  overwriteConflicts,
  preserveVisibility,
  preview,
}: ImportPreviewDialogProps) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.experiment.importData',
  });
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(preview.rotes.length / PREVIEW_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const includedRotes = useMemo(
    () => preview.rotes.filter((_, index) => !excludedIndexes.has(index)),
    [excludedIndexes, preview.rotes]
  );
  const visibleEntries = useMemo(
    () =>
      preview.rotes
        .map((rote, index) => ({ index, rote }))
        .slice((currentPage - 1) * PREVIEW_PAGE_SIZE, currentPage * PREVIEW_PAGE_SIZE),
    [currentPage, preview.rotes]
  );
  const visibleRotes = useMemo(() => visibleEntries.map((entry) => entry.rote), [visibleEntries]);
  const stats = useMemo(() => getRoteStats(includedRotes), [includedRotes]);
  const pageStart = preview.rotes.length === 0 ? 0 : (currentPage - 1) * PREVIEW_PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PREVIEW_PAGE_SIZE, preview.rotes.length);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isImporting) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <div className="flex items-center gap-2">
          <FileJson className="size-4" />
          <div className="truncate font-serif font-bold">{preview.fileName}</div>
        </div>
        <div>
          <div className="flex flex-wrap gap-1.5">
            <SummaryBadge label={t('notesFound')} value={stats.roteCount} />
            <SummaryBadge label={t('articlesFound')} value={stats.articleCount} />
            <SummaryBadge label={t('attachmentsFound')} value={stats.attachmentCount} />
            <SummaryBadge label={t('publicNotes')} value={stats.publicCount} />
            <SummaryBadge label={t('privateNotes')} value={stats.privateCount} />
            <SummaryBadge label={t('tagsFound')} value={stats.tagCount} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-medium">{t('previewSamples')}</div>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={currentPage === 1}
                  title={t('prevPage')}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="text-muted-foreground flex min-w-0 flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 text-xs tabular-nums">
                  <span>
                    {pageStart}-{pageEnd} / {preview.rotes.length}
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span>
                    {t('notesFound')}: {includedRotes.length}
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span>
                    {t('excludeNote')}: {excludedIndexes.size}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={currentPage === totalPages}
                  title={t('nextPage')}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto border">
              {preview.rotes.length === 0 && (
                <div className="text-muted-foreground p-4 text-center text-sm">
                  {t('sampleEmpty')}
                </div>
              )}
              {visibleRotes.length > 0 && (
                <RoteList
                  data={[visibleRotes]}
                  isValidating={false}
                  isItemMuted={(_, index) => excludedIndexes.has(visibleEntries[index].index)}
                  itemActions={(_, index) => {
                    const originalIndex = visibleEntries[index].index;
                    const excluded = excludedIndexes.has(originalIndex);

                    return (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => onToggleExclude(originalIndex)}
                        title={excluded ? t('restoreNote') : t('excludeNote')}
                      >
                        {excluded ? <RotateCcw className="size-4" /> : <X className="size-4" />}
                      </Button>
                    );
                  }}
                />
              )}
            </div>
          </div>

          <div className="bg-muted/40 flex flex-col gap-3 rounded-md p-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="preserve-visibility"
                checked={preserveVisibility}
                onCheckedChange={(checked) => onPreserveVisibilityChange(checked === true)}
                disabled={isImporting}
              />
              <Label htmlFor="preserve-visibility" className="flex flex-col gap-1">
                <span>{t('preserveVisibility')}</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {t('preserveVisibilityHint')}
                </span>
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="overwrite-conflicts"
                checked={overwriteConflicts}
                onCheckedChange={(checked) => onOverwriteConflictsChange(checked === true)}
                disabled={isImporting || preview.smartImportCount === 0}
              />
              <Label htmlFor="overwrite-conflicts" className="flex flex-col gap-1">
                <span>{t('overwriteConflicts')}</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {t('overwriteConflictsHint')}
                </span>
              </Label>
            </div>
          </div>

          <div className="text-muted-foreground text-xs leading-relaxed">
            {preview.smartImportCount === preview.roteCount
              ? t('smartImportReady')
              : t('legacyImportWarning', {
                  count: preview.roteCount - preview.smartImportCount,
                })}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onChooseAnother} variant="outline" disabled={isImporting}>
            <Upload className="size-4" />
            {t('chooseAnotherFile')}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isImporting || includedRotes.length === 0}
            variant="default"
          >
            {isImporting ? (
              <Loader className="size-4 animate-spin" />
            ) : (
              <CloudUpload className="size-4" />
            )}
            {isImporting ? t('importing') : t('confirmImport')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryBadge({ label, value }: { label: string; value: number }) {
  return (
    <Badge variant="secondary" className="text-muted-foreground font-normal">
      {label}: <span className="text-theme font-mono">{value}</span>
    </Badge>
  );
}

function getRoteStats(rotes: Rotes) {
  const articleIds = new Set<string>();
  const tags = new Set<string>();
  let attachmentCount = 0;
  let publicCount = 0;

  rotes.forEach((rote) => {
    if (typeof rote.articleId === 'string') {
      articleIds.add(rote.articleId);
    }
    if (typeof rote.article?.id === 'string') {
      articleIds.add(rote.article.id);
    }
    attachmentCount += Array.isArray(rote.attachments) ? rote.attachments.length : 0;
    rote.tags?.forEach((tag) => tags.add(tag));
    if (rote.state === 'public') {
      publicCount++;
    }
  });

  return {
    articleCount: articleIds.size,
    attachmentCount,
    privateCount: rotes.length - publicCount,
    publicCount,
    roteCount: rotes.length,
    tagCount: tags.size,
  };
}
