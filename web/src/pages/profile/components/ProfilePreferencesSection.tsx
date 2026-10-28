import { useTheme } from '@/components/theme-provider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { loadUserSettingsAtom, profileAtom, userSettingsAtom } from '@/state/profile';
import { put } from '@/utils/api';
import { getErrorMessage } from '@/utils/error';
import i18n from 'i18next';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export default function ProfilePreferencesSection() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });
  const { theme, setTheme } = useTheme();
  const profile = useAtomValue(profileAtom);
  const userSettings = useAtomValue(userSettingsAtom);
  const setUserSettings = useSetAtom(userSettingsAtom);
  const loadUserSettings = useSetAtom(loadUserSettingsAtom);
  const [lang, setLang] = useState(i18n.language);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    loadUserSettings();
  }, [loadUserSettings, profile]);

  const saveAllowExplore = async (checked: boolean) => {
    if (settingsSaving) return;

    try {
      setSettingsSaving(true);
      await put('/users/me/settings', {
        allowExplore: checked,
      });
      setUserSettings((current) => ({ ...current, allowExplore: checked }));
      toast.success(t('settings.saveSuccess'));
    } catch (error) {
      const errorMessage = getErrorMessage(error) || t('settings.unknownError');
      toast.error(t('settings.saveFailed', { error: errorMessage }));
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-base font-semibold">{t('settings.allowExploreLabel')}</div>
          <p className="text-muted-foreground text-sm">{t('settings.allowExploreDescription')}</p>
        </div>
        <Switch
          aria-label={t('settings.allowExploreLabel')}
          checked={userSettings.allowExplore}
          disabled={settingsSaving}
          onCheckedChange={saveAllowExplore}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-base font-semibold">{t('settings.themeLabel')}</div>
          <p className="text-muted-foreground text-sm">{t('settings.themeDescription')}</p>
        </div>
        <Select value={theme} onValueChange={(value) => setTheme(value as typeof theme)}>
          <SelectTrigger className="min-w-30" aria-label={t('settings.themeLabel')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">{t('settings.themeSystem')}</SelectItem>
            <SelectItem value="light">{t('settings.themeLight')}</SelectItem>
            <SelectItem value="dark">{t('settings.themeDark')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-base font-semibold">{t('settings.languageLabel')}</div>
          <p className="text-muted-foreground text-sm">{t('settings.languageDescription')}</p>
        </div>
        <Select
          value={lang}
          onValueChange={(value) => {
            setLang(value);
            i18n.changeLanguage(value);
          }}
        >
          <SelectTrigger className="min-w-30" aria-label={t('settings.languageLabel')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="zh">简体中文</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="ja">日本語</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
