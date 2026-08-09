import { EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function BlockedUserNotesState() {
  const { t } = useTranslation('translation', { keyPrefix: 'userBlocks.notesHidden' });

  return (
    <div
      role="status"
      className="bg-background flex shrink-0 flex-col items-center justify-center gap-3 px-6 py-8 text-center"
    >
      <EyeOff className="text-theme/30 size-10" />
      <div className="space-y-1">
        <div className="font-medium">{t('title')}</div>
        <div className="text-info text-sm font-light">{t('description')}</div>
      </div>
    </div>
  );
}
