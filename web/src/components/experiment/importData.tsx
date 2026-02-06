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
import { Download, HelpCircle, Loader2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { SoftBottom } from '../others/SoftBottom';
import { Button } from '../ui/button';

export default function ImportData() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.experiment.importData',
  });
  const [isImporting, setIsImporting] = useState(false);
  const [stats, setStats] = useState<{ noteCount: number } | null>(null);
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
          setStats({ noteCount: json.notes.length });
          setFileData(json);
          toast.success(t('fileParsed', { count: json.notes.length }));
        } else {
          toast.error(t('invalidFormat'));
        }
      } catch (error) {
        console.error('JSON Parse error:', error);
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
        success: boolean;
        count: number;
        created: number;
        updated: number;
      }>('/users/me/import', fileData);
      if (res.success) {
        toast.success(
          t('importSuccess', {
            count: res.count,
            created: res.created,
            updated: res.updated,
          }),
          {
            description: `Created: ${res.created}, Updated: ${res.updated}`,
            duration: 5000,
          }
        );
        setStats(null);
        setFileData(null);
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || t('importFailed'));
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
          {t('title')} <br />
          <div className="text-info mt-2 text-sm font-normal">{t('description')}</div>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <button className="border-border hover:bg-accent text-muted-foreground flex size-8 cursor-pointer items-center justify-center rounded-full border transition-colors">
              <HelpCircle className="size-4" />
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>使用说明</DialogTitle>
              <DialogDescription className="font-light">
                请上传符合以下 JSON 格式的文件。
              </DialogDescription>
            </DialogHeader>
            <div className="text-muted-foreground flex flex-col gap-4 text-sm">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-foreground mb-2 flex items-center justify-between text-xs font-semibold">
                  JSON 示例
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
                        },
                      ],
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
              <div className="text-xs leading-relaxed font-light">
                系统将根据 Note ID 进行匹配，如果 ID 已存在且属于您，将更新笔记内容；如果 ID
                不存在，将创建新笔记。
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
            <Upload className="text-muted-foreground size-12" />
            <div className="text-muted-foreground text-center">{t('clickToUpload')}</div>
          </div>
        ) : (
          <div className="flex w-full max-w-sm flex-col items-center gap-6">
            <div className="bg-accent/20 flex w-full flex-col items-center justify-center gap-2 p-6">
              <div className="text-4xl font-semibold">{stats.noteCount}</div>
              <div className="text-info text-sm">{t('notesFound')}</div>
            </div>

            <div className="flex w-full gap-4">
              <button
                onClick={() => {
                  setStats(null);
                  setFileData(null);
                }}
                className="border-border hover:bg-accent flex-1 rounded-md border px-4 py-2 text-sm transition-colors"
                disabled={isImporting}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="bg-foreground text-primary-foreground flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isImporting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {isImporting ? t('importing') : t('confirmImport')}
              </button>
            </div>
          </div>
        )}
      </div>

      <SoftBottom className="translate-y-4" spacer />
    </div>
  );
}
