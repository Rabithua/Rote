import { Rss } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function RssBlock({ username }: { username?: string }) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.user' });

  return (
    <div className="shrink-0">
      <div className="mb-2 mt-2">
        <a
          href={`${process.env.REACT_APP_BASEURL_PRD || 'http://localhost:3000'}/v1/api/rss/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="dark:bg-primaryDark/10 dark:hover:bg-primaryDark/20 dark:hover:text-primaryDark/80 flex w-fit items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-primary transition-all hover:bg-primary/20 hover:text-primary/80"
        >
          <Rss className="size-4" />
          <span>{t('rssSubscribe')}</span>
        </a>
      </div>
    </div>
  );
}
