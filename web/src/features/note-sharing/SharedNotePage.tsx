import { Helmet } from '@dr.pogodin/react-helmet';
import Linkify from 'linkify-react';
import { RefreshCw, Share } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link, useParams } from 'react-router-dom';
import AttachmentsGrid from '@/components/rote/AttachmentsGrid';
import { LinkPreviewCard } from '@/components/rote/LinkPreviewCard';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/others/UserAvatar';
import NavBar from '@/components/layout/navBar';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import { useSharedNote } from './useSharedNote';
import { SharedNoteLayout } from './SharedNoteLayout';
import { SharedNoteSidebar } from './SharedNoteSidebar';

function SharedNoteReader({ token }: { token: string }) {
  const { t, i18n } = useTranslation('translation', { keyPrefix: 'pages.sharedNote' });
  const { state, retry } = useSharedNote(token);
  const heading =
    state.status === 'ready'
      ? t('sharedBy', { name: state.note.author.nickname || state.note.author.username })
      : t('title');

  return (
    <SharedNoteLayout sidebar={<SharedNoteSidebar note={state.note} />}>
      <Helmet>
        <title>{heading}</title>
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      <NavBar title={heading} icon={<Share className="size-5" />} showBack={false}>
        <Button
          variant="ghost"
          size="icon"
          onClick={retry}
          disabled={state.status === 'loading'}
          aria-label={t('refresh')}
          className="ml-auto shrink-0"
        >
          <RefreshCw className={state.status === 'loading' ? 'animate-spin' : ''} />
        </Button>
      </NavBar>
      {state.status === 'loading' ? (
        <div role="status" aria-label={t('loading')} className="py-16">
          <LoadingPlaceholder />
        </div>
      ) : state.status !== 'ready' ? (
        <div className="space-y-4 px-5 py-12">
          <h1 className="text-xl font-semibold">
            {t(state.status === 'missing' ? 'unavailableTitle' : 'errorTitle')}
          </h1>
          <p role="alert" className="text-muted-foreground">
            {t(state.status === 'missing' ? 'unavailableDescription' : 'errorDescription')}
          </p>
          {state.status === 'error' && (
            <Button variant="outline" onClick={retry}>
              {t('retry')}
            </Button>
          )}
        </div>
      ) : (
        <article className="space-y-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <Link
              to={`/${encodeURIComponent(state.note.author.username)}`}
              reloadDocument
              aria-label={t('viewAuthor', {
                name: state.note.author.nickname || state.note.author.username,
              })}
              className="shrink-0 rounded-full"
            >
              <UserAvatar avatar={state.note.author.avatar || ''} className="size-10" />
            </Link>
            <div className="min-w-0">
              <Link
                to={`/${encodeURIComponent(state.note.author.username)}`}
                reloadDocument
                className="block truncate font-medium hover:underline"
                title={state.note.author.nickname || state.note.author.username}
              >
                {state.note.author.nickname || state.note.author.username}
              </Link>
              <time dateTime={state.note.createdAt} className="text-muted-foreground text-xs">
                {new Date(state.note.createdAt).toLocaleString(i18n.language)}
              </time>
            </div>
          </div>
          {state.note.title && (
            <h1 className="font-semibold wrap-break-word">{state.note.title}</h1>
          )}
          <div className="aTagStyle font-zhengwen wrap-break-word whitespace-pre-wrap">
            <Linkify options={{ target: '_blank', rel: 'noopener noreferrer' }}>
              {state.note.content}
            </Linkify>
          </div>
          {state.note.article && (
            <section
              aria-label={t('article')}
              className="prose prose-sm dark:prose-invert max-w-full border-t pt-4 wrap-break-word"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {state.note.article.content}
              </ReactMarkdown>
            </section>
          )}
          {state.note.attachments.length > 0 && (
            <AttachmentsGrid attachments={state.note.attachments} />
          )}
          {!state.note.article &&
            state.note.attachments.length === 0 &&
            state.note.linkPreviews.map((preview) => (
              <LinkPreviewCard key={preview.id} preview={preview} />
            ))}
          {state.note.tags.length > 0 && (
            <ul aria-label={t('tags')} className="flex flex-wrap gap-2">
              {state.note.tags.map((tag) => (
                <li key={tag} className="bg-foreground/5 rounded-md px-2 py-1 text-xs">
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </article>
      )}
    </SharedNoteLayout>
  );
}

export default function SharedNotePage() {
  const { token = '' } = useParams();
  return <SharedNoteReader key={token} token={token} />;
}
