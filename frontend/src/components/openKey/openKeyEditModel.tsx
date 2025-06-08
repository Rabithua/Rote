import mainJson from '@/json/main.json';
import { useOpenKeys } from '@/state/openKeys';
import { put } from '@/utils/api';
import { Save } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '../ui/checkbox';

interface OpenKey {
  id: string;
  permissions: string[];
}

interface OpenKeyEditModelProps {
  openKey: OpenKey;
  close: () => void;
}

function OpenKeyEditModel({ openKey, close }: OpenKeyEditModelProps) {
  const { t, i18n } = useTranslation('translation', {
    keyPrefix: 'components.openKeyEditModel',
  });
  const [openKeys, setOpenKeys] = useOpenKeys();
  const defaultCheckedList: string[] = openKey.permissions;
  const checkboxRef = useRef<HTMLButtonElement>(null);

  const processedOptions = useMemo(
    () =>
      mainJson.permissionOptions.map((option) => ({
        ...option,
        label: option.label[i18n.language as keyof typeof option.label],
      })),
    [i18n.language]
  );

  const [checkedList, setCheckedList] = useState<string[]>(defaultCheckedList);

  const checkAll = processedOptions.length === checkedList.length;

  const onChange = (value: string) => {
    setCheckedList((prev: string[]) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  // 修正 onCheckAllChange 以适配 shadcn Checkbox 的 onCheckedChange 签名
  const onCheckAllChange = (checked: boolean) => {
    setCheckedList(checked ? processedOptions.map((option) => option.value) : []);
  };

  function save() {
    if (checkedList.length === 0) {
      toast.error(t('minimumPermission'));
      return;
    }
    close();
    const toastId = toast.loading(t('saving'));
    put('/api-keys/' + openKey.id, { permissions: checkedList })
      .then((res) => {
        toast.success(t('saveSuccess'), {
          id: toastId,
        });
        setOpenKeys(openKeys.map((key) => (key.id === res.data.data.id ? res.data.data : key)));
      })
      .catch(() => {
        toast.error(t('saveFailed'), {
          id: toastId,
        });
      });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {processedOptions.map((option) => (
          <label
            key={option.value}
            className="bg-muted/60 flex w-fit cursor-pointer items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200 select-none"
          >
            <Checkbox
              checked={checkedList.includes(option.value)}
              onCheckedChange={() => onChange(option.value)}
              className="accent-primary scale-110"
            />
            <span className="text-foreground text-base font-medium">{option.label}</span>
          </label>
        ))}
      </div>
      <div className="mt-8 flex items-center gap-4 border-t pt-8">
        <Checkbox
          ref={checkboxRef}
          onCheckedChange={onCheckAllChange}
          checked={checkAll}
          className="accent-primary ml-auto scale-110"
        />
        <span className="text-muted-foreground text-sm select-none">{t('selectAll')}</span>
        <button
          className="bg-primary hover:bg-primary/80 focus:ring-primary/40 flex items-center gap-2 rounded-md px-5 py-2 font-semibold text-white shadow-md transition-all duration-200 focus:ring-2 focus:outline-none active:scale-95"
          onClick={save}
          type="button"
        >
          <Save className="size-4" />
          {t('save')}
        </button>
      </div>
    </div>
  );
}

export default OpenKeyEditModel;
