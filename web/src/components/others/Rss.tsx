import { Rss } from 'lucide-react';
import { useTranslation } from 'node_modules/react-i18next';

export default function RssBlock({ username }: { username?: string }) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.user' });

  return (
    <div className="shrink-0">
      <div className="mt-2 mb-2">
        <a
          href={`${process.env.REACT_APP_BASEURL_PRD || 'http://localhost:3000'}/v2/api/rss/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-theme dark:hover:bg-primaryDark/20 dark:hover:text-theme/80 bg-primary/10 hover:bg-primary/20 hover:text-theme/80 flex w-fit items-center gap-2 rounded-md px-3 py-1.5 transition-all"
        >
          <Rss className="size-4" />
          <span>{t('rssSubscribe')}</span>
        </a>
      </div>
    </div>
  );
}
