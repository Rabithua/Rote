import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Divider from '@/components/ui/divider';
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
import { Loader, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import useSWR from 'swr';
import PermissionSettingRow from './PermissionSettingRow';

type RoleDrafts = Partial<Record<ManageableRole, Record<CapabilityKey, CapabilityOverride>>>;

export default function PermissionsTab() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.permissions' });
  const profile = useProfile();
  const isSuperAdmin = profile?.role === 'super_admin';
  const [drafts, setDrafts] = useState<RoleDrafts>({});
  const [savingRole, setSavingRole] = useState<ManageableRole | null>(null);
  const { data, isLoading, mutate } = useSWR<RoleCapabilityPolicy[]>(
    '/admin/permissions/roles',
    async (url: string) => {
      const response = await get(url);
      return response.data as RoleCapabilityPolicy[];
    }
  );

  useEffect(() => {
    if (!data) return;
    setDrafts(
      Object.fromEntries(
        data
          .filter((policy) => MANAGEABLE_ROLES.includes(policy.role as ManageableRole))
          .map((policy) => [policy.role, policy.capabilities])
      ) as RoleDrafts
    );
  }, [data]);

  const updateRoleCapability = (
    role: ManageableRole,
    capability: CapabilityKey,
    effect: CapabilityOverride
  ) => {
    setDrafts((current) => ({
      ...current,
      [role]: {
        ...current[role],
        [capability]: effect,
      } as Record<CapabilityKey, CapabilityOverride>,
    }));
  };

  const saveRole = async (role: ManageableRole) => {
    const capabilities = drafts[role];
    if (!capabilities) return;

    setSavingRole(role);
    try {
      await put(`/admin/permissions/roles/${role}`, { capabilities });
      await mutate();
      toast.success(t('saveSuccess'));
    } catch (error) {
      toast.error(t('saveFailed', { error: getErrorMessage(error) || t('unknownError') }));
    } finally {
      setSavingRole(null);
    }
  };

  return (
    <Card className="rounded-none border-none shadow-none">
      <CardHeader className="pb-0">
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <Divider />
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
                  {isSuperAdmin && (
                    <Button
                      size="sm"
                      onClick={() => saveRole(role)}
                      disabled={!capabilities || savingRole !== null}
                    >
                      {savingRole === role ? (
                        <Loader className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      {t('saveRole')}
                    </Button>
                  )}
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
    </Card>
  );
}
