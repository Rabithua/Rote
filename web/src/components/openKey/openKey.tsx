import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { OpenKey, OpenKeyUsageLog } from '@/types/main';
import { API_URL, del, get } from '@/utils/api';
import { formatTimeAgo } from '@/utils/main';
import {
  Copy,
  Edit,
  Ellipsis,
  EyeClosed,
  EyeIcon,
  History,
  Loader,
  Loader2,
  Shield,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInView } from 'react-intersection-observer';
import { toast } from 'sonner';
import type { KeyedMutator } from 'swr';
import useSWRInfinite from 'swr/infinite';
import { ScrollArea } from '../ui/scroll-area';
import OpenKeyEditModel from './openKeyEditModel';

function OpenKeyItem({ openKey, mutate }: { openKey: OpenKey; mutate?: KeyedMutator<OpenKey[]> }) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.openKey',
  });
  const [, setOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState<boolean>(false);
  const [hidekey, setHideKey] = useState(true);
  const logLimit = 20;

  const { ref, inView } = useInView();

  const getKey = (pageIndex: number, previousPageData: OpenKeyUsageLog[]) => {
    if (!isLogDialogOpen) return null;
    if (previousPageData && !previousPageData.length) return null; // reached the end
    return `/api-keys/${openKey.id}/logs?limit=${logLimit}&skip=${pageIndex * logLimit}`;
  };

  const {
    data,
    size,
    setSize,
    isLoading: logsLoading,
  } = useSWRInfinite<OpenKeyUsageLog[]>(getKey, (url: string) => get(url).then((res) => res.data), {
    revalidateOnFocus: false,
  });

  const logsData = data ? data.flat() : [];
  const isLoadingMore = logsLoading || (size > 0 && data && typeof data[size - 1] === 'undefined');
  const isEmpty = data?.[0]?.length === 0;
  const isReachingEnd = isEmpty || (data && data[data.length - 1]?.length < logLimit);

  useEffect(() => {
    if (inView && !isReachingEnd && !isLoadingMore) {
      setSize((prev) => prev + 1);
    }
  }, [inView, isReachingEnd, isLoadingMore, setSize]);

  function formatLastUsed(lastUsedAt: string | null | undefined): string {
    if (!lastUsedAt) return t('neverUsed');
    return formatTimeAgo(lastUsedAt);
  }

  function actionsMenu() {
    function deleteOpenKey() {
      setOpen(false);
      const toastId = toast.loading(t('deleting'));
      del('/api-keys/' + openKey.id)
        .then(() => {
          toast.success(t('deleteSuccess'), {
            id: toastId,
          });
          if (mutate) {
            mutate();
          }
        })
        .catch(() => {
          toast.error(t('deleteFailed'), {
            id: toastId,
          });
        });
    }

    return (
      <>
        <DropdownMenuItem onClick={() => setIsLogDialogOpen(true)}>
          <History className="size-4" />
          {t('viewLogs')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setOpen(false);
            setIsModalOpen(true);
          }}
        >
          <Edit className="size-4" />
          {t('edit')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={deleteOpenKey} variant="destructive">
          <Trash2 className="size-4" />
          {t('delete')}
        </DropdownMenuItem>
      </>
    );
  }

  function onModelCancel() {
    setIsModalOpen(false);
  }

  function changeHideKey() {
    setHideKey(!hidekey);
  }

  async function copyToClipboard(): Promise<void> {
    const text = `${API_URL}/openkey/notes/create?openkey=${
      openKey.id
    }&content=${t('exampleContent')}&tag=${t('exampleTag')}&tag=${t('exampleTag2')}&state=private`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('copySuccess'));
    } catch {
      toast.error(t('copyFailed'));
    }
  }

  function getStatusColor(statusCode: number | null): string {
    if (!statusCode) return 'text-gray-400';
    if (statusCode >= 200 && statusCode < 300) return 'text-green-500';
    if (statusCode >= 400) return 'text-red-500';
    return 'text-yellow-500';
  }

  function getMethodColor(method: string): string {
    const colors: Record<string, string> = {
      GET: 'bg-blue-100 text-blue-700',
      POST: 'bg-green-100 text-green-700',
      PUT: 'bg-amber-100 text-amber-700',
      DELETE: 'bg-red-100 text-red-700',
    };
    return colors[method] || 'bg-gray-100 text-gray-700';
  }

  return (
    <div className="animate-show bg-background cursor-pointer p-4 opacity-0 duration-300">
      <div className="mr-auto flex items-center font-mono font-semibold break-all">
        {hidekey ? `${openKey.id.slice(0, 4)}****************${openKey.id.slice(-4)}` : openKey.id}
        {!hidekey ? (
          <EyeIcon
            onClick={changeHideKey}
            className="ml-1 size-8 rounded-lg p-2 hover:bg-[#00000010]"
          />
        ) : (
          <EyeClosed
            onClick={changeHideKey}
            className="ml-1 size-8 rounded-lg p-2 hover:bg-[#00000010]"
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Ellipsis className="absolute top-2 right-2 size-8 rounded-lg p-2 hover:bg-[#00000010]" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">{actionsMenu()}</DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="font-mono text-sm break-all">
        {t('permissions')}：{openKey.permissions.join(', ')}
      </div>
      <div className="text-primary/30">
        {t('example')}：
        <span className="font-mono break-all">
          {`${API_URL}/openkey/notes/create?openkey=${
            hidekey
              ? `${openKey.id.slice(0, 4)}****************${openKey.id.slice(-4)}`
              : openKey.id
          }&content=${t('exampleContent')}&tag=${t('exampleTag')}&tag=${t('exampleTag2')}&state=private`}
        </span>
        <button
          type="button"
          onClick={copyToClipboard}
          aria-label={t('copy')}
          className="ml-auto size-6 rounded-sm p-1 hover:bg-[#00000010]"
        >
          <Copy className="size-4" />
        </button>
      </div>

      <div className="text-primary/60 mt-1 flex items-center gap-4 text-sm">
        <span>
          {t('usageCount')}：{openKey.usageCount ?? 0}
        </span>
        <span>
          {t('lastUsedAt')}：{formatLastUsed(openKey.lastUsedAt)}
        </span>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="gap-0 divide-y p-0">
          <div className="flex items-center gap-2 p-4 text-lg font-bold">
            <Shield className="size-5" />
            {t('editPermissions')}{' '}
          </div>

          <OpenKeyEditModel
            close={onModelCancel}
            openKey={openKey}
            mutate={mutate}
          ></OpenKeyEditModel>
        </DialogContent>
      </Dialog>

      {/* Usage Logs Dialog */}
      <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('usageLogs')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            {logsData && logsData.length > 0 ? (
              <div className="space-y-2">
                {logsData.map((log) => (
                  <div key={log.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${getMethodColor(log.method)}`}
                      >
                        {log.method}
                      </span>
                      <span className="font-mono text-xs">{log.endpoint}</span>
                      <span
                        className={`ml-auto font-mono text-xs ${getStatusColor(log.statusCode)}`}
                      >
                        {log.statusCode ?? '-'}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-4 text-xs">
                      <span>{log.clientIp || '-'}</span>
                      <span>{log.responseTime ? `${log.responseTime}ms` : '-'}</span>
                      <span className="ml-auto">{formatTimeAgo(log.createdAt)}</span>
                    </div>
                    {log.errorMessage && (
                      <div className="mt-1 text-xs text-red-500">{log.errorMessage}</div>
                    )}
                  </div>
                ))}
                {!isReachingEnd && (
                  <div ref={ref} className="flex justify-center py-4">
                    <Loader2 className="size-6 animate-spin" />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                {isLoadingMore ? (
                  <div className="flex justify-center py-4">
                    <Loader className="size-6 animate-spin" />
                  </div>
                ) : (
                  t('noLogs')
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default OpenKeyItem;
