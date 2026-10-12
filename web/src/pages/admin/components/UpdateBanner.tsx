import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowUpCircle, ArrowUpRight, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useReleaseUpdate from '../releases/useReleaseUpdate';

export default function UpdateBanner() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.updateBanner' });
  const update = useReleaseUpdate();
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  if (!update || dismissedVersion === update.latestVersion) return null;

  return (
    <aside
      aria-label={t('title')}
      className="bg-primary text-primary-foreground flex items-center justify-between border-b-0"
    >
      <div
        role="region"
        aria-label={t('title')}
        tabIndex={0}
        className="noScrollBar focus-visible:ring-primary-foreground/50 flex min-w-0 flex-1 items-center gap-2 self-stretch overflow-x-auto px-3 outline-none focus-visible:ring-1 focus-visible:ring-inset"
      >
        <ArrowUpCircle aria-hidden="true" className="size-4 shrink-0" />
        <span className="shrink-0 text-xs font-medium whitespace-nowrap sm:text-sm">
          {t('title')}
        </span>
        <span
          aria-label={t('versions', {
            current: update.currentVersion,
            latest: update.latestVersion,
          })}
          className="flex shrink-0 items-center gap-1.5 font-mono text-xs tabular-nums"
        >
          <span className="text-primary-foreground/60 whitespace-nowrap">
            {update.currentVersion}
          </span>
          <ArrowRight aria-hidden="true" className="text-primary-foreground/40 size-3 shrink-0" />
          <span className="font-semibold whitespace-nowrap">{update.latestVersion}</span>
        </span>
      </div>

      <div className="divide-primary-foreground/15 border-primary-foreground/15 flex shrink-0 items-center divide-x border-l">
        <Button
          asChild
          variant="ghost"
          className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground dark:hover:bg-primary-foreground/10 gap-1.5 rounded-none text-xs transition-colors focus-visible:ring-inset"
        >
          <a href={update.releaseUrl} target="_blank" rel="noopener noreferrer">
            {t('viewRelease')}
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </a>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('dismiss')}
          onClick={() => setDismissedVersion(update.latestVersion)}
          className="text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground dark:hover:bg-primary-foreground/10 rounded-none transition-colors focus-visible:ring-inset"
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </aside>
  );
}
