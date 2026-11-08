import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProfile } from '@/state/profile';
import {
  CAPABILITY_KEYS,
  MANAGEABLE_ROLES,
  type CapabilityKey,
  type CapabilityOverride,
  type ManageableRole,
  type RoleCapabilityPolicy,
} from '@/types/permissions';
import { get, put } from '@/utils/api';
import { getErrorMessage } from '@/utils/error';
import { Loader } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import useSWR from 'swr';
import PermissionSettingRow from './PermissionSettingRow';
import AdminSettingsPanel from '../settings/AdminSettingsPanel';

interface PermissionsTabProps {
  onSavingChange?: (saving: boolean) => void;
}

interface PendingPermission {
  role: ManageableRole;
  capability: CapabilityKey;
  effect: CapabilityOverride;
}

export default function PermissionsTab({ onSavingChange }: PermissionsTabProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.permissions' });
  const profile = useProfile();
  const isSuperAdmin = profile?.role === 'super_admin';
  const [pending, setPending] = useState<PendingPermission | null>(null);
  const isSaving = pending !== null;
  const { data, isLoading, mutate } = useSWR<RoleCapabilityPolicy[]>(
    '/admin/permissions/roles',
    async (url: string) => {
      const response = await get(url);
      return response.data as RoleCapabilityPolicy[];
    }
  );
  useEffect(() => {
    onSavingChange?.(isSaving);
  }, [isSaving, onSavingChange]);
  useEffect(() => () => onSavingChange?.(false), [onSavingChange]);

  const saveCapability = async (
    role: ManageableRole,
    capability: CapabilityKey,
    effect: CapabilityOverride
  ) => {
    const current = data?.find((policy) => policy.role === role)?.capabilities[capability];
    if (!isSuperAdmin || isSaving || current === undefined || current === effect) return;

    setPending({ role, capability, effect });
    try {
      await mutate(
        async () => {
          const response = await put<{ data: RoleCapabilityPolicy[] }>(
            `/admin/permissions/roles/${role}`,
            { capabilities: { [capability]: effect } }
          );
          return response.data;
        },
        { revalidate: false }
      );
      toast.success(t('saveSuccess'));
    } catch (error) {
      toast.error(t('saveFailed', { error: getErrorMessage(error) || t('unknownError') }));
    } finally {
      setPending(null);
    }
  };

  return (
    <AdminSettingsPanel
      header={
        <CardHeader className="pb-0">
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
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
            const policy = data?.find((entry) => entry.role === role);
            const pendingForRole = pending?.role === role ? pending : null;
            return (
              <section key={role} className="border">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                  <div>
                    <h3 className="font-semibold">{t(`roles.${role}.label`)}</h3>
                    <p className="text-muted-foreground text-sm">
                      {t(`roles.${role}.description`)}
                    </p>
                  </div>
                  <span role="status" className="text-muted-foreground text-sm empty:hidden">
                    {pendingForRole && t('saving')}
                  </span>
                </div>
                <div className="px-4">
                  {policy &&
                    CAPABILITY_KEYS.map((capability) => (
                      <PermissionSettingRow
                        key={capability}
                        capability={capability}
                        value={
                          pendingForRole?.capability === capability
                            ? pendingForRole.effect
                            : policy.capabilities[capability]
                        }
                        options={['inherit', 'allow', 'deny']}
                        disabled={!isSuperAdmin || isSaving}
                        effective={policy.effective[capability]}
                        onChange={(effect) => saveCapability(role, capability, effect)}
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
