import { Dialog, DialogContent } from '@/components/ui/dialog';

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import toast from 'react-hot-toast';
import OpenKeyEditModel from './openKeyEditModel';
import { apiDeleteOneMyOpenKey } from '@/api/rote/main';
import { useOpenKeys } from '@/state/openKeys';
import { useTranslation } from 'react-i18next';
import { Copy, Edit, Ellipsis, EyeClosed, EyeIcon, Terminal, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

function OpenKeyItem({ openKey }: any) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.openKey',
  });
  const [, setOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [openKeysData, setOpenKeysData] = useOpenKeys();
  const [hidekey, setHideKey] = useState(true);

  function actionsMenu() {
    function deleteOpenKey() {
      setOpen(false);
      const toastId = toast.loading(t('deleting'));
      apiDeleteOneMyOpenKey(openKey.id)
        .then((res) => {
          toast.success(t('deleteSuccess'), {
            id: toastId,
          });
          setOpenKeysData(openKeysData.filter((key) => key.id !== res.data.data.id));
        })
        .catch(() => {
          toast.error(t('deleteFailed'), {
            id: toastId,
          });
        });
    }

    return (
      <>
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
    // setEditRote({});
  }

  function changeHideKey() {
    setHideKey(!hidekey);
  }

  async function copyToClipboard(): Promise<void> {
    const text = `${
      process.env.REACT_APP_BASEURL_PRD || 'http://localhost:3000'
    }/v1/api/openkey/onerote?openkey=${openKey.id}&content=这是一条使用OpenKey发送的笔记。&tag=FromOpenKey&tag=标签二&state=private`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('copySuccess'));
    } catch (err) {
      toast.error(t('copyFailed'));
    }
  }

  return (
    <div className="animate-show bg-bgLight dark:bg-bgDark cursor-pointer p-4 opacity-0 duration-300">
      <div className="mr-auto flex items-center font-mono font-semibold break-all">
        {hidekey ? `${openKey.id.slice(0, 4)}****************${openKey.id.slice(-4)}` : openKey.id}
        {hidekey ? (
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
      <div className="">
        {t('permissions')}：{openKey.permissions.join(',')}
      </div>
      <div className="">
        {t('example')}：
        <span className="font-mono break-all">
          {process.env.REACT_APP_BASEURL_PRD || 'http://localhost:3000'}
          /v1/api/openkey/onerote?openkey=
          {hidekey
            ? `${openKey.id.slice(0, 4)}****************${openKey.id.slice(-4)}`
            : openKey.id}
          &content=这是一条使用OpenKey发送的笔记。&tag=FromOpenKey&tag=标签二&state=private
        </span>
        <span onClick={copyToClipboard}>
          <Copy className="ml-auto size-8 rounded-lg p-2 hover:bg-[#00000010]" />
        </span>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <Alert>
            <Terminal className="h-4 w-4" />
            <AlertTitle>Still Developing!</AlertTitle>
            <AlertDescription>
              The OpenKey edit feature is still under development. Maybe not work well.
            </AlertDescription>
          </Alert>
          <OpenKeyEditModel close={onModelCancel} openKey={openKey}></OpenKeyEditModel>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default OpenKeyItem;
