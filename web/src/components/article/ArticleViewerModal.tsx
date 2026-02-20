import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { Article } from '@/types/main';
import { getArticleFull } from '@/utils/articleApi';
import { DialogTitle } from '@radix-ui/react-dialog';
import { Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

interface Props {
  articleId: string | null;
  noteId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 是否允许编辑（仅作者可编辑）
  editable?: boolean;
}

export function ArticleViewerModal({ articleId, noteId, open, onOpenChange, editable }: Props) {
  const { t } = useTranslation('translation', { keyPrefix: 'article.viewer' });
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) {
      setArticle(null);
      setLoading(false);
      return;
    }
    if (!articleId) return;
    setLoading(true);
    getArticleFull(articleId, noteId)
      .then((data) => {
        setArticle(data);
      })
      .catch((error: any) => {
        const msg = error?.response?.data?.message || t('loadFailed');
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [articleId, noteId, open, t]);

  const content = loading ? (
    <div className="space-y-3">
      <Skeleton className="h-7 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-[50vh] w-full" />
    </div>
  ) : article ? (
    <div className="prose prose-sm dark:prose-invert noScrollBar max-h-[80vh] max-w-none flex-1 overflow-scroll overflow-y-auto py-6">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content}</ReactMarkdown>
    </div>
  ) : (
    <div className="text-muted-foreground text-sm">{t('notFound')}</div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTitle className="hidden px-6 pt-4 text-lg font-semibold">{t('title')}</DialogTitle>
        <DialogContent className="max-w-screen rounded-none sm:max-w-3xl">
          {editable && article && (
            <div className="absolute right-12 bottom-12 z-1">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/article/${articleId}/edit`);
                }}
                aria-label={t('edit')}
                title={t('edit')}
              >
                <Pencil className="size-4" />
              </Button>
            </div>
          )}
          {content}
        </DialogContent>
      </Dialog>
    </>
  );
}
