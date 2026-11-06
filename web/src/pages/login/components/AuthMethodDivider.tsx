import { useTranslation } from 'react-i18next';

export function AuthMethodDivider() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.login' });

  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="bg-border h-px flex-1" />
      <span className="text-muted-foreground text-xs">{t('entry.or')}</span>
      <span className="bg-border h-px flex-1" />
    </div>
  );
}
