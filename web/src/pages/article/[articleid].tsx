import { VerifiedIcon } from '@/components/icons/Verified';
import NavBar from '@/components/layout/navBar';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import UserAvatar from '@/components/others/UserAvatar';
import { Button } from '@/components/ui/button';
import { useArticleActions } from '@/hooks/useArticleActions';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import { profileAtom } from '@/state/profile';
import { API_URL, get } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { formatBytes } from '@/utils/main';
import { parseMarkdownMeta } from '@/utils/markdownParser';
import { useAtomValue } from 'jotai';
import {
  ArrowUpRight,
  BookOpen,
  Download,
  FileText,
  Link as LinkIcon,
  Navigation,
  PenBox,
  RefreshCw,
  Rss,
  TextInitialIcon,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { Link, useNavigate, useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

function ArticleDetailPage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.article' });
  const { t: tEditor } = useTranslation('translation', { keyPrefix: 'article.editor' });
  const navigate = useNavigate();
  const { articleid } = useParams();
  const profile = useAtomValue(profileAtom);

  const {
    data: article,
    isLoading,
    mutate,
    isValidating,
  } = useAPIGet<any>(articleid || '', () => get('/articles/' + articleid).then((res) => res.data), {
    onError: (err: any) => {
      const hasResponse = err?.response !== undefined;
      const status = err?.response?.status;
      if (!hasResponse || (status && status >= 400)) {
        navigate('/404');
      }
    },
  });

  const refreshData = () => {
    if (isLoading || isValidating) {
      return;
    }
    mutate();
  };

  // 使用共享 hook 处理复制链接和删除操作
  const { isDeleting, handleCopyLink, handleDelete } = useArticleActions({
    articleId: articleid,
    onDeleted: () => {
      navigate('/');
    },
  });

  // 判断是否为作者
  const isAuthor = profile && article?.author && profile.username === article.author.username;

  const handleDownload = () => {
    if (!article?.content) return;
    const { title } = parseMarkdownMeta(article.content);
    const blob = new Blob([article.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = title ? `${title}.md` : 'article.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const SideBar = () =>
    isLoading ? (
      <LoadingPlaceholder className="py-8" size={6} />
    ) : (
      <div className="">
        {article?.author && (
          <div className="border-b p-4">
            <Link to={`/${article.author.username}`} className="block">
              <div className="flex items-center gap-3">
                <UserAvatar
                  avatar={article.author.avatar}
                  className="bg-foreground/5 text-primary size-12"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-primary inline-flex items-center gap-1 truncate font-semibold">
                    {article.author.nickname}
                    {article.author.emailVerified && (
                      <VerifiedIcon className="text-theme size-4 shrink-0" />
                    )}
                  </div>
                  <div className="text-info truncate text-sm">@{article.author.username}</div>
                </div>
              </div>
            </Link>
          </div>
        )}
        <div className="grid grid-cols-3 divide-x border-b">
          <a
            href={`${API_URL}/rss/${article?.author?.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-foreground/3 flex cursor-pointer items-center justify-center gap-2 py-4"
          >
            <Rss className="size-5" />
            <div className="text-xl">RSS</div>
          </a>
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="text-xl">☝️</div>
          </div>
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="text-xl">🤓</div>
          </div>
        </div>
      </div>
    );

  return isLoading ? (
    <LoadingPlaceholder className="py-16" size={6} />
  ) : article ? (
    <ContainerWithSideBar
      sidebar={<SideBar />}
      sidebarHeader={
        <div className="flex items-center gap-2 p-3 text-lg font-semibold">
          <Navigation className="size-5" />
          <div className="flex items-center gap-2">{t('sideBarTitle')}</div>
        </div>
      }
      floatButtons={
        isAuthor ? (
          <>
            <Button
              size="icon"
              className="rounded-md shadow-md"
              onClick={() => navigate(`/article/${articleid}/edit`)}
              aria-label="Edit article"
              title="Edit article"
            >
              <PenBox className="size-4" />
            </Button>
            <Button
              size="icon"
              className="rounded-md shadow-md"
              onClick={handleCopyLink}
              aria-label="Copy article link"
              title="Copy article link"
            >
              <LinkIcon className="size-4" />
            </Button>
            <Button
              size="icon"
              className="rounded-md shadow-md"
              onClick={handleDelete}
              disabled={isDeleting}
              aria-label="Delete article"
              title="Delete article"
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        ) : null
      }
      className="pb-16"
    >
      <NavBar
        onNavClick={refreshData}
        title={t('title')}
        icon={<BookOpen className="text-primary size-6" />}
      >
        <div className="flex-1" />
        <div className="flex items-center divide-x font-mono text-xs font-normal">
          <div className="flex items-center gap-2 px-2">
            <TextInitialIcon className="size-3" />
            {tEditor('wordsCount', {
              defaultValue: '{{count}} Words',
              count: article?.content?.length || 0,
            })}
          </div>
          <div
            className="group hidden cursor-pointer items-center gap-2 px-2 lg:flex"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            title={tEditor('download', { defaultValue: 'Download Markdown' })}
          >
            <FileText className="size-3 group-hover:hidden" />
            <Download className="hidden size-3 group-hover:block" />
            {formatBytes(new Blob([article?.content || '']).size)}
          </div>
        </div>
        {isLoading ||
          (isValidating && (
            <RefreshCw className="text-primary size-4 animate-spin p-4 duration-300" />
          ))}
      </NavBar>
      <div className="divide-y">
        <div className="prose prose-sm dark:prose-invert max-w-full p-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content}</ReactMarkdown>
        </div>
        {article.note && (
          <Link
            to={`/rote/${article.note.id}`}
            className="block p-4 text-sm font-light hover:underline"
          >
            {t('relatedNote')}: {article.note.content}
            <ArrowUpRight className="inline size-4" />
          </Link>
        )}
      </div>
    </ContainerWithSideBar>
  ) : null;
}

export default ArticleDetailPage;
