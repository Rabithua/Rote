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
import PermissionSettingRow from './PermissionSettingRow';

type PermissionUser = { id: string; username: string; role: string };
type UserPermissionsDialogProps = {
  user: PermissionUser | null;
  onClose: () => void;
  canManage: boolean;
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
  onSavingChange,
}: Omit<UserPermissionsDialogProps, 'user'> & { user: PermissionUser }) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.permissions' });
  const [pending, setPending] = useState<{
    capability: CapabilityKey;
    effect: CapabilityOverride;
  } | null>(null);
  const isSaving = pending !== null;
  const { data, isLoading, mutate } = useSWR<UserCapabilityPermissions>(
    `/admin/permissions/users/${user.id}`,
    async (url: string) => {
      const response = await get(url);
      return response.data as UserCapabilityPermissions;
    }
  );
  useEffect(() => {
    onSavingChange?.(isSaving);
  }, [isSaving, onSavingChange]);
  useEffect(() => () => onSavingChange?.(false), [onSavingChange]);

  const requestClose = () => {
    if (!isSaving) onClose();
  };

  const saveCapability = async (capability: CapabilityKey, effect: CapabilityOverride) => {
    if (!canManage || isSaving || !data || (data.overrides[capability] ?? 'inherit') === effect)
      return;

    setPending({ capability, effect });
    try {
      await mutate(
        async () => {
          const response = await put<{ data: UserCapabilityPermissions }>(
            `/admin/permissions/users/${user.id}`,
            { capabilities: { [capability]: effect } }
          );
          return response.data;
        },
        { revalidate: false }
      );
      toast.success(t('userDialog.saveSuccess'));
    } catch (error) {
      toast.error(
        t('userDialog.saveFailed', { error: getErrorMessage(error) || t('unknownError') })
      );
    } finally {
      setPending(null);
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
          <span role="status" className="text-muted-foreground text-sm empty:sr-only">
            {isSaving && t('saving')}
          </span>
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
                  value={
                    pending?.capability === capability
                      ? pending.effect
                      : (data.overrides[capability] ?? 'inherit')
                  }
                  options={['inherit', 'allow', 'deny']}
                  disabled={!canManage || isSaving}
                  effective={data.capabilities[capability]}
                  onChange={(effect) => saveCapability(capability, effect)}
                />
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="bg-background flex-row border-t pt-4">
          <Button
            variant="outline"
            onClick={requestClose}
            disabled={isSaving}
            className="h-auto min-h-9 min-w-0 flex-1 whitespace-normal sm:flex-none"
          >
            {t('userDialog.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
