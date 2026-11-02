import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProfile } from '@/state/profile';
import {
  CAPABILITY_KEYS,
  MANAGEABLE_ROLES,
  type CapabilityOverride,
  type ManageableRole,
  type RoleCapabilityPolicy,
} from '@/types/permissions';
import { get, put } from '@/utils/api';
import { getErrorMessage } from '@/utils/error';
import { Loader, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import useSWR from 'swr';
import PermissionSettingRow from './PermissionSettingRow';
import { usePermissionsDrafts } from './permissionsDrafts';
import AdminSettingsPanel from '../settings/AdminSettingsPanel';

interface PermissionsTabProps {
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
}

export default function PermissionsTab({ onDirtyChange, onSavingChange }: PermissionsTabProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.permissions' });
  const profile = useProfile();
  const isSuperAdmin = profile?.role === 'super_admin';
  const [savingRole, setSavingRole] = useState<ManageableRole | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { data, isLoading, mutate } = useSWR<RoleCapabilityPolicy[]>(
    '/admin/permissions/roles',
    async (url: string) => {
      const response = await get(url);
      return response.data as RoleCapabilityPolicy[];
    }
  );
  const { drafts, dirtyRoles, hasUnsavedChanges, markRoleSaved, updateRoleCapability } =
    usePermissionsDrafts(data);

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onDirtyChange]);

  useEffect(() => {
    onSavingChange?.(savingRole !== null);
  }, [onSavingChange, savingRole]);

  useEffect(
    () => () => {
      onDirtyChange?.(false);
      onSavingChange?.(false);
    },
    [onDirtyChange, onSavingChange]
  );

  const saveRole = async (role: ManageableRole) => {
    const capabilities = drafts[role];
    if (!capabilities || savingRole !== null || !dirtyRoles.includes(role)) return;

    setSaveError(null);
    setSavingRole(role);
    try {
      const response = await put<{ data: RoleCapabilityPolicy[] }>(
        `/admin/permissions/roles/${role}`,
        { capabilities }
      );
      markRoleSaved(role, capabilities);
      await mutate(response.data, { revalidate: false });
      toast.success(t('saveSuccess'));
    } catch (error) {
      const message = t('saveFailed', { error: getErrorMessage(error) || t('unknownError') });
      setSaveError(message);
      toast.error(message);
    } finally {
      setSavingRole(null);
    }
  };

  return (
    <AdminSettingsPanel
      isDirty={hasUnsavedChanges}
      saveError={saveError}
      header={
        <CardHeader className="pb-0">
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
      }
      actions={
        isSuperAdmin && (
          <div className="flex flex-wrap justify-end gap-2">
            {MANAGEABLE_ROLES.map((role) => (
              <Button
                key={role}
                size="sm"
                onClick={() => saveRole(role)}
                disabled={!drafts[role] || savingRole !== null || !dirtyRoles.includes(role)}
              >
                {savingRole === role ? (
                  <Loader className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {t('saveRoleFor', { role: t(`roles.${role}.label`) })}
              </Button>
            ))}
          </div>
        )
      }
    >
      <CardContent className="space-y-6">
        {!isSuperAdmin && (
          <p className="text-muted-foreground text-sm">{t('readOnlyDescription')}</p>
        )}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader className="size-6 animate-spin" />
          </div>
        ) : (
          MANAGEABLE_ROLES.map((role) => {
            const capabilities = drafts[role];
            const effective = data?.find((policy) => policy.role === role)?.effective;
            return (
              <section key={role} className="border">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                  <div>
                    <h3 className="font-semibold">{t(`roles.${role}.label`)}</h3>
                    <p className="text-muted-foreground text-sm">
                      {t(`roles.${role}.description`)}
                    </p>
                  </div>
                </div>
                <div className="px-4">
                  {capabilities &&
                    CAPABILITY_KEYS.map((capability) => (
                      <PermissionSettingRow
                        key={capability}
                        capability={capability}
                        value={capabilities[capability]}
                        options={['inherit', 'allow', 'deny']}
                        disabled={!isSuperAdmin}
                        effective={effective?.[capability]}
                        onChange={(effect) =>
                          updateRoleCapability(role, capability, effect as CapabilityOverride)
                        }
                      />
                    ))}
                </div>
              </section>
            );
          })
        )}
      </CardContent>
    </AdminSettingsPanel>
  );
}
