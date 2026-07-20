import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FileUp, LoaderCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { FetchProgress } from './converters/memos-api';
import ImportPlatformPicker, { getImportPlatform } from './ImportPlatformPicker';
import {
  prepareImport,
  type ImportMode,
  type ImportPayload,
  type ImportSource,
  type MemosUserSelection,
} from './sourceLoader';

interface ImportSourceFormProps {
  disabled?: boolean;
  onPrepared: (payload: ImportPayload, displayName: string, warnings: Array<string>) => void;
  onError: (message: string) => void;
}

const FILE_ACCEPT: Record<ImportSource, string> = {
  rote: '.json,application/json',
  memos: '.json,.db,.sqlite,.sqlite3',
  flomo: '.html,.htm,.zip',
  weread: '.json,.txt',
};

export default function ImportSourceForm({
  disabled = false,
  onPrepared,
  onError,
}: ImportSourceFormProps) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.experiment.importData.migration',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<ImportSource | null>(null);
  const [mode, setMode] = useState<ImportMode>('file');
  const [file, setFile] = useState<File>();
  const [memosBaseUrl, setMemosBaseUrl] = useState('');
  const [memosToken, setMemosToken] = useState('');
  const [wereadApiKey, setWereadApiKey] = useState('');
  const [progress, setProgress] = useState<FetchProgress>();
  const [isPreparing, setIsPreparing] = useState(false);
  const [memosSelection, setMemosSelection] = useState<MemosUserSelection>();
  const [selectedMemosUserId, setSelectedMemosUserId] = useState<number>();

  const resetFileState = useCallback(() => {
    setFile(undefined);
    setProgress(undefined);
    setMemosSelection(undefined);
    setSelectedMemosUserId(undefined);
  }, []);

  const handleSourceSelect = useCallback(
    (nextSource: ImportSource) => {
      setSource(nextSource);
      setMode('file');
      resetFileState();
    },
    [resetFileState]
  );

  const handleBackToPlatforms = useCallback(() => {
    setSource(null);
    setMode('file');
    setMemosBaseUrl('');
    setMemosToken('');
    setWereadApiKey('');
    resetFileState();
  }, [resetFileState]);

  const handleModeChange = useCallback(
    (value: ImportMode) => {
      setMode(value);
      resetFileState();
    },
    [resetFileState]
  );

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0]);
    setProgress(undefined);
    setMemosSelection(undefined);
    setSelectedMemosUserId(undefined);
    event.target.value = '';
  }, []);

  const handlePrepare = useCallback(async () => {
    if (!source) return;

    setIsPreparing(true);
    setProgress(undefined);
    try {
      const result = await prepareImport({
        source,
        mode,
        file,
        memosBaseUrl,
        memosToken,
        wereadApiKey,
        parsedMemosData: memosSelection?.data,
        selectedMemosUserId,
        onProgress: setProgress,
      });

      if (result.kind === 'select-memos-user') {
        setMemosSelection(result);
        return;
      }

      onPrepared(result.payload, result.displayName, result.warnings);
      handleBackToPlatforms();
    } catch (error) {
      onError(error instanceof Error ? error.message : t('errors.prepare'));
    } finally {
      setIsPreparing(false);
    }
  }, [
    file,
    handleBackToPlatforms,
    memosBaseUrl,
    memosSelection,
    memosToken,
    mode,
    onError,
    onPrepared,
    selectedMemosUserId,
    source,
    t,
    wereadApiKey,
  ]);

  const isBusy = disabled || isPreparing;
  const platform = source ? getImportPlatform(source) : undefined;
  const platformName = platform ? t(platform.nameKey) : '';
  const supportsApi = source === 'memos' || source === 'weread';
  const limitationKey = source === 'memos' ? `limitations.memos.${mode}` : `limitations.${source}`;
  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isBusy) handleBackToPlatforms();
    },
    [handleBackToPlatforms, isBusy]
  );

  return (
    <>
      <ImportPlatformPicker disabled={isBusy} onSelect={handleSourceSelect} />

      <Dialog open={source !== null} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md" closeLabel={t('close')}>
          {source && platform && (
            <div className="flex flex-col gap-5">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-base">
                  <img
                    src={platform.logo}
                    alt=""
                    width={28}
                    height={28}
                    className="aspect-square size-7 shrink-0 rounded-md object-cover drop-shadow-sm"
                    aria-hidden="true"
                  />
                  <span className="truncate">{platformName}</span>
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {t('dialogDescription', { platform: platformName })}
                </DialogDescription>
              </DialogHeader>

              {supportsApi && (
                <Tabs value={mode} onValueChange={(value) => handleModeChange(value as ImportMode)}>
                  <TabsList className="w-full">
                    {(['file', 'api'] as const).map((nextMode) => (
                      <TabsTrigger key={nextMode} value={nextMode} disabled={isBusy}>
                        {t(`modes.${nextMode}`)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}

              {mode === 'file' && (
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={FILE_ACCEPT[source]}
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-14 w-full justify-start px-4 py-3"
                    disabled={isBusy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileUp className="text-muted-foreground size-5 shrink-0" />
                    <span className="min-w-0 truncate text-sm font-medium">
                      {file?.name ?? t('chooseFile')}
                    </span>
                  </Button>
                </div>
              )}

              {source === 'memos' && mode === 'api' && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="memos-base-url">{t('memosBaseUrl')}</Label>
                    <Input
                      id="memos-base-url"
                      name="memos-base-url"
                      type="url"
                      autoComplete="off"
                      spellCheck={false}
                      value={memosBaseUrl}
                      placeholder="https://memos.example.com"
                      disabled={isBusy}
                      onChange={(event) => setMemosBaseUrl(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="memos-token">{t('accessToken')}</Label>
                    <Input
                      id="memos-token"
                      name="memos-token"
                      type="password"
                      value={memosToken}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={isBusy}
                      onChange={(event) => setMemosToken(event.target.value)}
                    />
                  </div>
                </div>
              )}

              {source === 'weread' && mode === 'api' && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="weread-api-key">{t('wereadApiKey')}</Label>
                  <Input
                    id="weread-api-key"
                    name="weread-api-key"
                    type="password"
                    value={wereadApiKey}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={isBusy}
                    onChange={(event) => setWereadApiKey(event.target.value)}
                  />
                  <Button asChild variant="link" className="h-auto w-fit p-0 text-xs">
                    <a
                      href="https://weread.qq.com/r/weread-skills"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('wereadKeyLink')}
                    </a>
                  </Button>
                </div>
              )}

              <div className="text-muted-foreground flex flex-col gap-1 text-xs leading-relaxed">
                {[1, 2].map((index) => (
                  <p key={index}>
                    <span aria-hidden="true">* </span>
                    {t(`${limitationKey}.${index}`)}
                  </p>
                ))}
              </div>

              {memosSelection && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="memos-user">{t('memosUser')}</Label>
                  <Select
                    value={selectedMemosUserId?.toString()}
                    onValueChange={(value) => setSelectedMemosUserId(Number(value))}
                  >
                    <SelectTrigger id="memos-user" className="w-full">
                      <SelectValue placeholder={t('memosUserPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {memosSelection.users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.nickname || user.username || String(user.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {progress && (
                <p className="text-muted-foreground text-xs" aria-live="polite">
                  {progress.message}
                  {progress.total ? ` · ${progress.current}/${progress.total}` : ''}
                </p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={isBusy || (!!memosSelection && !selectedMemosUserId)}
                  onClick={handlePrepare}
                >
                  {isPreparing && <LoaderCircle className="size-4 animate-spin" />}
                  {isPreparing ? t('preparing') : t('prepare')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
