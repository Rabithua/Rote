import { Navigation } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import UserAvatar from '@/components/others/UserAvatar';
import type { SharedNote } from './types';

export function SharedNoteSidebar({ note }: { note?: SharedNote }) {
  const { t, i18n } = useTranslation('translation', { keyPrefix: 'pages.sharedNote' });
  const updatedAt =
    note?.article && Date.parse(note.article.updatedAt) > Date.parse(note.updatedAt)
      ? note.article.updatedAt
      : note?.updatedAt;

  return (
    <aside aria-label={t('about')} className="divide-y">
      <div className="flex items-center gap-2 p-3 text-lg font-semibold">
        <Navigation className="size-5 shrink-0" />
        {t('about')}
      </div>
      {note && (
        <div className="flex items-center gap-3 p-4">
          <UserAvatar
            avatar={note.author.avatar}
            className="bg-foreground/5 text-primary size-12 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p
              className="truncate font-semibold"
              title={note.author.nickname || note.author.username}
            >
              {note.author.nickname || note.author.username}
            </p>
            <p className="text-info truncate text-sm" title={`@${note.author.username}`}>
              @{note.author.username}
            </p>
          </div>
        </div>
      )}
      <div className="space-y-2 p-4 text-sm">
        <p className="font-medium">{t('readOnly')}</p>
        <p className="text-muted-foreground leading-relaxed">{t('readOnlyDescription')}</p>
      </div>
      {updatedAt && (
        <dl className="space-y-2 p-4 text-sm">
          <dt className="text-muted-foreground">{t('updatedAt')}</dt>
          <dd>
            <time dateTime={updatedAt}>
              {new Date(updatedAt).toLocaleString(i18n.language, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </time>
          </dd>
        </dl>
      )}
    </aside>
  );
}
