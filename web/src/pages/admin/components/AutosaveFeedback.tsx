import { Button } from '@/components/ui/button';
import { Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AutosaveStatus } from './useUiAutosave';

export default function AutosaveFeedback({
  status,
  onRetry,
}: {
  status?: AutosaveStatus;
  onRetry: () => void;
}) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.autosave' });
  if (!status) return null;
  return (
    <div className="flex items-center gap-2 text-xs" role="status" aria-live="polite">
      {status.state === 'saving' && <Loader className="size-3 animate-spin" />}
      <span className={status.state === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
        {status.state === 'error'
          ? t('failed', { error: status.error || t('unknownError') })
          : t(status.state)}
      </span>
      {status.state === 'error' && (
        <Button type="button" size="sm" variant="ghost" className="h-6 px-2" onClick={onRetry}>
          {t('retry')}
        </Button>
      )}
    </div>
  );
}
