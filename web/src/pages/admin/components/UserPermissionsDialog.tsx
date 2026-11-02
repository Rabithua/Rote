import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CAPABILITY_KEYS,
  type CapabilityKey,
  type CapabilityOverride,
  type UserCapabilityPermissions,
} from '@/types/permissions';
import { get, put } from '@/utils/api';
import { getErrorMessage } from '@/utils/error';
import { Loader } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import useSWR from 'swr';
import UnsavedSettingsDialog from '../settings/UnsavedSettingsDialog';
import { useAdminSettingsDraft } from '../settings/useAdminSettingsDraft';
import PermissionSettingRow from './PermissionSettingRow';

type PermissionUser = { id: string; username: string; role: string };
type UserPermissionsDialogProps = {
  user: PermissionUser | null;
  onClose: () => void;
  canManage: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
};
export default function UserPermissionsDialog(props: UserPermissionsDialogProps) {
  return props.user ? (
    <UserPermissionsEditor {...props} user={props.user} key={props.user.id} />
  ) : null;
}
function UserPermissionsEditor({
  user,
  onClose,
  canManage,
  onDirtyChange,
  onSavingChange,
}: Omit<UserPermissionsDialogProps, 'user'> & { user: PermissionUser }) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.permissions' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [closeRequested, setCloseRequested] = useState(false);
  const { data, isLoading, mutate } = useSWR<UserCapabilityPermissions>(
    `/admin/permissions/users/${user.id}`,
    async (url: string) => {
      const response = await get(url);
      return response.data as UserCapabilityPermissions;
    }
  );
  const form = useAdminSettingsDraft<Partial<Record<CapabilityKey, CapabilityOverride>>>(
    data?.overrides || {}
  );
  useEffect(() => {
    onDirtyChange?.(form.isDirty);
  }, [form.isDirty, onDirtyChange]);
  useEffect(() => {
    onSavingChange?.(isSaving);
  }, [isSaving, onSavingChange]);
  useEffect(
    () => () => {
      onDirtyChange?.(false);
      onSavingChange?.(false);
    },
    [onDirtyChange, onSavingChange]
  );
  const requestClose = () => {
    if (isSaving) return;
    if (form.isDirty) setCloseRequested(true);
    else onClose();
  };
  const save = async () => {
    if (!canManage || isSaving || isLoading || !data || !form.isDirty) return;
    const submitted = form.value;
    setSaveError(null);
    setIsSaving(true);
    try {
      const response = await put<{ data: UserCapabilityPermissions }>(
        `/admin/permissions/users/${user.id}`,
        { capabilities: submitted }
      );
      form.markSaved(submitted, response.data.overrides);
      setIsSaving(false);
      void mutate(response.data, { revalidate: false });
      onDirtyChange?.(false);
      toast.success(t('userDialog.saveSuccess'));
      onClose();
    } catch (error) {
      const message = t('userDialog.saveFailed', {
        error: getErrorMessage(error) || t('unknownError'),
      });
      setSaveError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <DialogContent
        showCloseButton={!isSaving}
        closeLabel={t('userDialog.close')}
        className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader className="pr-6">
          <DialogTitle>{t('userDialog.title', { username: user.username })}</DialogTitle>
          <DialogDescription>{t('userDialog.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4" data-slot="user-permissions-body">
          {!canManage && (
            <p className="text-muted-foreground mb-4 text-sm">{t('readOnlyDescription')}</p>
          )}
          {isLoading || !data ? (
            <div className="flex justify-center py-10">
              <Loader className="size-6 animate-spin" />
            </div>
          ) : (
            <div className="border px-4">
              {CAPABILITY_KEYS.map((capability) => (
                <PermissionSettingRow
                  key={capability}
                  capability={capability}
                  value={form.value[capability] || 'inherit'}
                  options={['inherit', 'allow', 'deny']}
                  disabled={!canManage || isSaving}
                  effective={data.capabilities[capability]}
                  onChange={(effect) =>
                    form.setValue({ ...form.value, [capability]: effect as CapabilityOverride })
                  }
                />
              ))}
            </div>
          )}
        </div>
        <div className="bg-background space-y-3 border-t pt-4">
          {saveError && (
            <p className="text-destructive text-sm" role="alert">
              {saveError}
            </p>
          )}
          <DialogFooter className="flex-row">
            <Button
              variant="outline"
              onClick={requestClose}
              disabled={isSaving}
              className="h-auto min-h-9 min-w-0 flex-1 whitespace-normal sm:flex-none"
            >
              {t('userDialog.close')}
            </Button>
            {canManage && (
              <Button
                onClick={() => void save()}
                className="h-auto min-h-9 min-w-0 flex-1 whitespace-normal sm:flex-none"
                disabled={isLoading || !data || isSaving || !form.isDirty}
              >
                {isSaving && <Loader className="size-4 animate-spin" />}
                {t('userDialog.save')}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
      <UnsavedSettingsDialog
        open={closeRequested}
        isSaving={isSaving}
        onContinue={() => setCloseRequested(false)}
        onDiscard={() => {
          if (!isSaving) {
            onDirtyChange?.(false);
            onClose();
          }
        }}
      />
    </Dialog>
  );
}
