import type { ReactNode } from 'react';
import { BookOpen, StickyNote } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SideContentLayout } from '@/components/layout/SideContentLayout';
import { Button } from '@/components/ui/button';

export function SharedNoteLayout({
  children,
  sidebar,
  hasArticle,
}: {
  children: ReactNode;
  sidebar: ReactNode;
  hasArticle: boolean;
}) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.sharedNote' });

  return (
    <div className="bg-background text-primary mx-auto w-full max-w-6xl">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] font-sans sm:divide-x xl:w-[90%]">
        <nav
          aria-label={t('readingNavigation')}
          className="bg-background/90 sticky top-0 hidden h-dvh shrink-0 flex-col items-center justify-center gap-4 px-2 sm:flex lg:w-[200px] lg:px-4"
        >
          <Button asChild variant="ghost" className="rounded-full">
            <a href="#shared-note" aria-label={t('note')} title={t('note')}>
              <StickyNote className="size-4" />
              <span className="hidden text-base tracking-widest lg:block">{t('note')}</span>
            </a>
          </Button>
          {hasArticle && (
            <Button asChild variant="ghost" className="rounded-full">
              <a href="#shared-article" aria-label={t('article')} title={t('article')}>
                <BookOpen className="size-4" />
                <span className="hidden text-base tracking-widest lg:block">{t('article')}</span>
              </a>
            </Button>
          )}
        </nav>
        <div className="flex min-w-0 flex-1 md:divide-x">
          <main
            id="shared-note"
            tabIndex={-1}
            className="relative min-w-0 flex-1 scroll-mt-4 divide-y focus:outline-none"
          >
            {children}
          </main>
          <SideContentLayout>{sidebar}</SideContentLayout>
        </div>
      </div>
    </div>
  );
}
