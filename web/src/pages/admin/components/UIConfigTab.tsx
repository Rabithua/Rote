import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SystemConfig } from '../types';
import AdminSettingsPanel from '../settings/AdminSettingsPanel';
import AutosaveFeedback from './AutosaveFeedback';
import AutosaveNumberField from './AutosaveNumberField';
import { useUiAutosave, type AutosaveField, type UiSettingsUpdate } from './useUiAutosave';

interface UIConfigTabProps {
  uiConfig: SystemConfig['ui'];
  securityConfig: SystemConfig['security'];
  onMutate: () => unknown;
  onSaved?: (update: UiSettingsUpdate) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
}
export default function UIConfigTab({ onDirtyChange, onSavingChange, ...props }: UIConfigTabProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin' });
  const form = useUiAutosave(props);
  const [rateDirty, setRateDirty] = useState(false);
  const [videoDirty, setVideoDirty] = useState(false);
  const isDirty = rateDirty || videoDirty;
  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);
  useEffect(() => onSavingChange?.(form.isSaving), [form.isSaving, onSavingChange]);
  useEffect(
    () => () => {
      onDirtyChange?.(false);
      onSavingChange?.(false);
    },
    [onDirtyChange, onSavingChange]
  );
  const feedback = (field: AutosaveField) => (
    <AutosaveFeedback status={form.statuses[field]} onRetry={() => form.retry(field)} />
  );
  return (
    <AdminSettingsPanel
      header={
        <CardHeader className="pb-0">
          <CardTitle>{t('ui.title')}</CardTitle>
          <CardDescription>{t('ui.description')}</CardDescription>
          <p className="text-muted-foreground text-sm">{t('autosave.description')}</p>
        </CardHeader>
      }
    >
      <CardContent className="space-y-4">
        {(['allowRegistration', 'allowUploadFile'] as const).map((field) => (
          <div key={field} className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor={field}>{t(`ui.${field}`)}</Label>
              <p className="text-muted-foreground text-sm">{t(`ui.${field}Desc`)}</p>
              {feedback(field)}
            </div>
            <Switch
              id={field}
              checked={form.ui[field] ?? true}
              disabled={form.statuses[field]?.state === 'saving'}
              onCheckedChange={(checked) => void form.saveUi(field, checked)}
            />
          </div>
        ))}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="requireCertifiedUserForExplore">
              {t('security.requireCertifiedUserForExplore')}
            </Label>
            <p className="text-muted-foreground text-sm">
              {t('security.requireCertifiedUserForExploreDesc')}
            </p>
            {feedback('requireCertifiedUserForExplore')}
          </div>
          <Switch
            id="requireCertifiedUserForExplore"
            checked={form.policy}
            disabled={form.statuses.requireCertifiedUserForExplore?.state === 'saving'}
            onCheckedChange={(checked) => void form.savePolicy(checked)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="defaultUserRole">{t('ui.defaultUserRole')}</Label>
          <Select
            value={form.ui.defaultUserRole || 'user'}
            disabled={form.statuses.defaultUserRole?.state === 'saving'}
            onValueChange={(value) => void form.saveUi('defaultUserRole', value)}
          >
            <SelectTrigger id="defaultUserRole" className="w-full">
              <SelectValue placeholder={t('ui.defaultUserRolePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">{t('ui.roles.user')}</SelectItem>
              <SelectItem value="moderator">{t('ui.roles.moderator')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">{t('ui.defaultUserRoleDescription')}</p>
          {feedback('defaultUserRole')}
        </div>
        <AutosaveNumberField
          id="apiRateLimit"
          label={t('ui.apiRateLimit')}
          description={t('ui.apiRateLimitDescription')}
          value={form.ui.apiRateLimit ?? 100}
          minimum={10}
          validationKey="invalidRateLimit"
          status={form.statuses.apiRateLimit}
          onCommit={(value) => form.saveUi('apiRateLimit', value)}
          onDirtyChange={setRateDirty}
        />
        <AutosaveNumberField
          id="maxVideoUploadSizeMB"
          label={t('ui.maxVideoUploadSizeMB')}
          description={t('ui.maxVideoUploadSizeMBDesc')}
          value={form.ui.maxVideoUploadSizeMB ?? 300}
          minimum={1}
          validationKey="invalidVideoLimit"
          status={form.statuses.maxVideoUploadSizeMB}
          onCommit={(value) => form.saveUi('maxVideoUploadSizeMB', value)}
          onDirtyChange={setVideoDirty}
        />
      </CardContent>
    </AdminSettingsPanel>
  );
}
