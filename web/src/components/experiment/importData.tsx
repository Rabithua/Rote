import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Divider } from '@/components/ui/divider';
import ImportSourceForm from '@/features/import/ImportSourceForm';
import type { ImportPayload } from '@/features/import/sourceLoader';
import { post } from '@/utils/api';
import saveAs from 'file-saver';
import { Download, FileJson, HelpCircle, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAtomValue } from 'jotai';
import { profileAtom } from '@/state/profile';
import type { Rote, Rotes } from '@/types/main';
import { SoftBottom } from '../others/SoftBottom';
import { Button } from '../ui/button';
import ImportPreviewDialog, { type ImportPreview } from './ImportPreviewDialog';

type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

type ImportResult = {
  count: number;
  created: number;
  updated: number;
  unchanged: number;
  notes: {
    total: number;
    created: number;
    updated: number;
    unchanged: number;
  };
  articles: {
    total: number;
    created: number;
    updated: number;
  };
  attachments: {
    total: number;
    created: number;
    updated: number;
    deleted: number;
  };
};

export default function ImportData() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.experiment.importData',
  });
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [fileData, setFileData] = useState<ImportPayload | null>(null);
  const [excludedIndexes, setExcludedIndexes] = useState<Set<number>>(new Set());
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [preserveVisibility, setPreserveVisibility] = useState(false);
  const profile = useAtomValue(profileAtom);
  const exampleData = {
    articles: [
      {
        id: '660e8400-e29b-41d4-a716-446655440001',
        content: '# Example Article\n\nArticle content...',
        authorId: 'user-uuid',
        createdAt: '2024-03-20T09:55:00Z',
        updatedAt: '2024-03-20T10:00:00Z',
      },
    ],
    notes: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        content: 'Note content...',
        tags: ['tag1', 'tag2'],
        state: 'private',
        articleId: '660e8400-e29b-41d4-a716-446655440001',
        article: {
          id: '660e8400-e29b-41d4-a716-446655440001',
          content: '# Example Article\n\nArticle content...',
          authorId: 'user-uuid',
          createdAt: '2024-03-20T09:55:00Z',
          updatedAt: '2024-03-20T10:00:00Z',
        },
        createdAt: '2024-03-20T10:00:00Z',
        updatedAt: '2024-03-20T10:00:00Z',
        attachments: [
          {
            id: '770e8400-e29b-41d4-a716-446655440002',
            url: 'https://...',
            storage: 'R2',
            details: {
              originalName: 'image.png',
              mimeType: 'image/png',
              size: 1024,
            },
          },
        ],
      },
    ],
  };

  const buildPreview = useCallback(
    (json: ImportPayload, fileName: string): ImportPreview => {
      const uniqueArticles = Array.from(
        new Map(
          [
            ...(Array.isArray(json.articles) ? json.articles : []),
            ...json.notes
              .map((note: any) => note?.article)
              .filter((article: unknown): article is Record<string, any> => !!article),
          ]
            .filter((article: any) => typeof article?.id === 'string')
            .map((article: any) => [article.id, article])
        ).values()
      );
      const articleIds = new Set<string>(uniqueArticles.map((article: any) => article.id));
      const tags = new Set<string>();
      let attachmentCount = 0;
      let publicCount = 0;
      let privateCount = 0;

      json.notes.forEach((note: any) => {
        if (typeof note?.articleId === 'string') {
          articleIds.add(note.articleId);
        }
        if (typeof note?.article?.id === 'string') {
          articleIds.add(note.article.id);
        }
        if (Array.isArray(note?.attachments)) {
          attachmentCount += note.attachments.length;
        }
        if (Array.isArray(note?.tags)) {
          note.tags.forEach((tag: unknown) => {
            if (typeof tag === 'string' && tag.trim()) tags.add(tag.trim());
          });
        }
        if (note?.state === 'public') {
          publicCount++;
        } else {
          privateCount++;
        }
      });

      return {
        fileName,
        articleCount: articleIds.size,
        roteCount: json.notes.length,
        attachmentCount,
        publicCount,
        privateCount,
        tagCount: tags.size,
        smartImportCount: json.notes.filter(
          (note: any) =>
            typeof note?.source?.provider === 'string' &&
            typeof note?.source?.accountId === 'string' &&
            typeof note?.source?.externalId === 'string'
        ).length,
        rotes: json.notes.map((note) => ({
          ...(note as Rote),
          authorid: profile?.id,
          author: {
            username: profile?.username || '',
            nickname: profile?.nickname || '',
            avatar: profile?.avatar || '',
            certified: profile?.certified ?? false,
          },
          reactions: [],
        })) as Rotes,
      };
    },
    [profile]
  );

  const clearPreview = useCallback(() => {
    setIsPreviewOpen(false);
    setPreview(null);
    setFileData(null);
    setExcludedIndexes(new Set());
    setOverwriteExisting(false);
    setPreserveVisibility(false);
  }, []);

  const toggleExcludedIndex = (index: number) => {
    setExcludedIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const buildImportPayload = () => {
    if (!fileData || !Array.isArray(fileData.notes)) return fileData;

    const notes = fileData.notes.filter((_: unknown, index: number) => !excludedIndexes.has(index));

    return {
      ...fileData,
      notes,
      articles: fileData.articles,
    };
  };

  const handlePrepared = useCallback(
    (payload: ImportPayload, displayName: string, warnings: Array<string>) => {
      setPreview(buildPreview(payload, displayName));
      setPreviewVersion((version) => version + 1);
      setFileData(payload);
      setExcludedIndexes(new Set());
      setOverwriteExisting(false);
      setPreserveVisibility(false);
      setIsPreviewOpen(true);
      toast.success(t('fileParsed', { count: payload.notes.length }));
      if (warnings.length > 0) {
        toast.warning(t('migration.warningTitle'), {
          description: warnings.join('\n'),
          duration: 8000,
        });
      }
    },
    [buildPreview, t]
  );

  const handlePrepareError = useCallback(
    (message: string) => {
      toast.error(message || t('migration.errors.prepare'));
    },
    [t]
  );

  const handleImport = async () => {
    if (!fileData) return;

    try {
      setIsImporting(true);
      const payload = buildImportPayload();
      const res = await post<ApiResponse<ImportResult>>(
        '/users/me/import',
        {
          ...payload,
          importOptions: {
            existingStrategy: overwriteExisting ? 'overwrite' : 'skip',
            visibilityStrategy: preserveVisibility ? 'preserve' : 'private',
          },
        },
        { timeout: 300_000 }
      );
      if (res) {
        const data = res.data;

        toast.success(t('importSuccessTitle'), {
          description: t('importSuccessSummary', { count: data.notes.total }),
          duration: 5000,
        });
        toast.info(
          t('importSuccessNotes', {
            total: data.notes.total,
            created: data.notes.created,
            updated: data.notes.updated,
            unchanged: data.notes.unchanged,
          }),
          { duration: 5000 }
        );
        toast.info(
          t('importSuccessArticles', {
            total: data.articles.total,
            created: data.articles.created,
            updated: data.articles.updated,
          }),
          { duration: 5000 }
        );
        toast.info(
          t('importSuccessAttachments', {
            total: data.attachments.total,
            created: data.attachments.created,
            updated: data.attachments.updated,
            deleted: data.attachments.deleted,
          }),
          { duration: 5000 }
        );
        clearPreview();
      }
    } catch (_error: any) {
      // console.error('Import error:', error);
      toast.error(_error.message || t('importFailed'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadExample = () => {
    const blob = new Blob([JSON.stringify(exampleData, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    saveAs(blob, 'rote-import-example.json');
  };

  return (
    <div className="noScrollBar relative w-full overflow-x-hidden overflow-y-scroll p-4 sm:aspect-square">
      <div className="flex w-full items-center justify-between">
        <div className="text-2xl font-semibold">
          <div className="flex items-center">
            {t('title')}
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-1 size-8"
                  aria-label={t('dialogTitle')}
                >
                  <HelpCircle className="size-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" closeLabel={t('cancel')}>
                <DialogHeader>
                  <DialogTitle>{t('dialogTitle')}</DialogTitle>
                  <DialogDescription className="font-light">
                    {t('dialogDescription')}
                  </DialogDescription>
                </DialogHeader>
                <div className="text-muted-foreground flex flex-col gap-4 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-foreground mb-2 flex items-center justify-between text-xs font-semibold">
                      {t('dialogExample')}
                      <Button
                        variant="ghost"
                        className="cursor-pointer"
                        onClick={handleDownloadExample}
                      >
                        <Download className="size-3" />
                      </Button>
                    </div>
                    <pre className="text-muted-foreground overflow-x-auto text-[10px] leading-tight">
                      {JSON.stringify(exampleData, null, 2)}
                    </pre>
                  </div>
                  <div className="text-xs leading-relaxed font-light">{t('dialogNote')}</div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="text-info mt-2 text-sm font-normal">{t('description')}</div>
        </div>
      </div>
      <Divider></Divider>

      <div className="flex flex-col items-center justify-center gap-6 pb-8">
        {!preview ? (
          <ImportSourceForm
            disabled={isImporting}
            onPrepared={handlePrepared}
            onError={handlePrepareError}
          />
        ) : (
          <div className="flex w-full max-w-sm flex-col items-center gap-4">
            <div className="border-border bg-muted/30 flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <FileJson className="text-primary size-4 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{preview.fileName}</div>
                  <div className="text-muted-foreground truncate text-xs">
                    {t('notesFound')}: {preview.roteCount} · {t('articlesFound')}:{' '}
                    {preview.articleCount} · {t('attachmentsFound')}: {preview.attachmentCount}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={clearPreview}
                disabled={isImporting}
                title={t('cancel')}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex w-full flex-wrap justify-center gap-3">
              <Button onClick={() => setIsPreviewOpen(true)} disabled={isImporting}>
                <FileJson className="size-4" />
                {t('openPreview')}
              </Button>
              <Button onClick={clearPreview} variant="outline" disabled={isImporting}>
                {t('chooseAnotherFile')}
              </Button>
            </div>
          </div>
        )}

        {preview && (
          <ImportPreviewDialog
            key={previewVersion}
            isImporting={isImporting}
            onChooseAnother={clearPreview}
            onConfirm={handleImport}
            onOpenChange={setIsPreviewOpen}
            open={isPreviewOpen}
            preview={preview}
            overwriteExisting={overwriteExisting}
            preserveVisibility={preserveVisibility}
            excludedIndexes={excludedIndexes}
            onToggleExclude={toggleExcludedIndex}
            onOverwriteExistingChange={setOverwriteExisting}
            onPreserveVisibilityChange={setPreserveVisibility}
          />
        )}
      </div>

      <SoftBottom className="translate-y-4" spacer />
    </div>
  );
}
