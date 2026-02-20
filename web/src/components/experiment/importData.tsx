import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Divider } from '@/components/ui/divider';
import { post } from '@/utils/api';
import saveAs from 'file-saver';
import {
  ArrowUpRight,
  CloudUpload,
  Download,
  HelpCircle,
  Loader,
  PocketKnife,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { SlidingNumber } from '../animate-ui/text/sliding-number';
import { SoftBottom } from '../others/SoftBottom';
import { Button } from '../ui/button';

export default function ImportData() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.experiment.importData',
  });
  const [isImporting, setIsImporting] = useState(false);
  const [stats, setStats] = useState<{
    noteCount: number;
    attachmentCount: number;
  } | null>(null);
  const [fileData, setFileData] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.notes && Array.isArray(json.notes)) {
          let attachmentCount = 0;
          json.notes.forEach((note: any) => {
            if (note.attachments && Array.isArray(note.attachments)) {
              attachmentCount += note.attachments.length;
            }
          });

          setStats({
            noteCount: json.notes.length,
            attachmentCount,
          });
          setFileData(json);
          toast.success(t('fileParsed', { count: json.notes.length }));
        } else {
          toast.error(t('invalidFormat'));
        }
      } catch (_error) {
        // console.error('JSON Parse error:', error);
        toast.error(t('parseError'));
      }
    };
    reader.readAsText(file);
    // Reset input value so same file can be selected again if needed
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!fileData) return;

    try {
      setIsImporting(true);
      const res = await post<{
        count: number;
        created: number;
        updated: number;
      }>('/users/me/import', fileData);
      if (res) {
        // Handle variable structure: might be flat or nested in data
        const data = (res as any).data || res;
        toast.success(
          t('importSuccess', {
            count: data.count,
            created: data.created,
            updated: data.updated,
          }),
          {
            duration: 5000,
          }
        );
        setStats(null);
        setFileData(null);
      }
    } catch (_error: any) {
      // console.error('Import error:', error);
      toast.error(_error.message || t('importFailed'));
    } finally {
      setIsImporting(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadExample = () => {
    const exampleData = {
      notes: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Example Note',
          content: 'Note content...',
          tags: ['tag1', 'tag2'],
          state: 'private',
          createdAt: '2024-03-20T10:00:00Z',
          updatedAt: '2024-03-20T10:00:00Z',
          attachments: [
            {
              id: 'attachment-uuid',
              originalName: 'image.png',
              mimeType: 'image/png',
              size: 1024,
              url: 'https://...',
            },
          ],
        },
      ],
    };
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
                <HelpCircle className="ml-2 inline-block size-6 cursor-pointer" />
              </DialogTrigger>
              <DialogContent>
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
                      {JSON.stringify(
                        {
                          notes: [
                            {
                              id: '550e8400-e29b-41d4-a716-446655440000',
                              title: 'Example Note',
                              content: 'Note content...',
                              tags: ['tag1', 'tag2'],
                              state: 'private',
                              createdAt: '2024-03-20T10:00:00Z',
                              updatedAt: '2024-03-20T10:00:00Z',
                              attachments: [
                                {
                                  id: 'attachment-uuid',
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
                        },
                        null,
                        2
                      )}
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

      <div className="flex flex-col items-center justify-center gap-6 py-8">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".json"
          onChange={handleFileChange}
        />

        {!stats ? (
          <div
            onClick={triggerFileSelect}
            className="border-border hover:bg-accent/50 flex w-full max-w-sm cursor-pointer flex-col items-center justify-center gap-4 border border-dashed p-10 transition-colors"
          >
            <Upload className="text-muted-foreground size-6" />
            <div className="text-muted-foreground text-center text-sm">{t('clickToUpload')}</div>
          </div>
        ) : (
          <div className="flex w-full max-w-sm flex-col items-center gap-6">
            <div className="bg-accent/20 flex w-full items-center justify-around p-6">
              <div className="flex flex-col items-center justify-center gap-2">
                <SlidingNumber
                  className="text-4xl font-semibold"
                  number={stats.noteCount}
                ></SlidingNumber>
                <div className="text-info text-sm">{t('notesFound')}</div>
              </div>
              <div className="flex flex-col items-center justify-center gap-2">
                <SlidingNumber
                  className="text-4xl font-semibold"
                  number={stats.attachmentCount}
                ></SlidingNumber>
                <div className="text-info text-sm">{t('attachmentsFound')}</div>
              </div>
            </div>

            <div className="flex w-full justify-center gap-4">
              <Button
                onClick={() => {
                  setStats(null);
                  setFileData(null);
                }}
                variant="secondary"
                disabled={isImporting}
              >
                {t('cancel')}
              </Button>
              <Button onClick={handleImport} disabled={isImporting} variant="default">
                {isImporting ? (
                  <Loader className="size-4 animate-spin" />
                ) : (
                  <CloudUpload className="size-4" />
                )}
                {isImporting ? t('importing') : t('confirmImport')}
              </Button>
            </div>
          </div>
        )}

        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xs leading-relaxed font-light">
            <PocketKnife className="mr-1 mb-[2px] inline-block size-3" />
            {t('convertToolHint')}
            <a
              href="https://rerote.vercel.app/"
              target="_blank"
              rel="noreferrer"
              className="text-primary ml-1 underline"
            >
              {t('convertToolLinkName')}
            </a>
            <ArrowUpRight className="ml-1 inline-block size-3" />
          </div>
        </div>
      </div>

      <SoftBottom className="translate-y-4" spacer />
    </div>
  );
}
