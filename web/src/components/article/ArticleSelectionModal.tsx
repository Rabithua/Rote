import { ArticleCard } from '@/components/article/ArticleCard';
import { ArticleEditorModal } from '@/components/article/ArticleEditorModal';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { profileAtom } from '@/state/profile';
import type { Article, ArticleSummary } from '@/types/main';
import { listMyArticles } from '@/utils/articleApi';
import { useAtomValue } from 'jotai';
import { Signature } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import LoadingPlaceholder from '../others/LoadingPlaceholder';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 当前选中的文章（用于缓存回显）
  selectedArticle?: Article | null;
  // 选择文章后的回调（会自动关闭 dialog）
  onSelect: (article: Article) => void;
  onCreateNew: () => void;
}

export function ArticleSelectionModal({
  open,
  onOpenChange,
  selectedArticle,
  onSelect,
  onCreateNew,
}: Props) {
  const { t } = useTranslation('translation', { keyPrefix: 'article.selection' });
  const profile = useAtomValue(profileAtom);
  const [remoteArticles, setRemoteArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  // 编辑文章的状态
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const fetchArticles = () => {
    setLoading(true);
    listMyArticles()
      .then((list) => {
        setRemoteArticles(list);
      })
      .catch((error) => {
        const msg = error?.response?.data?.message || t('fetchFailed', 'Failed to fetch articles');
        toast.error(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-adjust-state-on-prop-change
      fetchArticles();
    }
  }, [open]);

  const displayArticles = useMemo(() => {
    const list = [...remoteArticles];
    if (selectedArticle && !list.find((a) => a.id === selectedArticle.id)) {
      list.unshift(selectedArticle);
    }
    return list;
  }, [remoteArticles, selectedArticle]);

  const handleSelect = (article: Article) => {
    onSelect(article);
    onOpenChange(false);
  };

  const handleEdit = (article: Article | ArticleSummary) => {
    // 需要完整的 Article 才能编辑
    const fullArticle = remoteArticles.find((a) => a.id === article.id);
    if (fullArticle) {
      setEditingArticle(fullArticle);
      setEditorOpen(true);
    }
  };

  const handleDeleted = () => {
    // 刷新文章列表
    fetchArticles();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTitle className="hidden px-6 pt-4 text-lg font-semibold">{t('title')}</DialogTitle>
        <DialogContent
          className="flex max-h-[85vh] flex-col overflow-visible"
          aria-describedby={undefined}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-visible pt-6">
            {/* 创建新文章 */}
            <button
              type="button"
              className="bg-secondary w-full cursor-pointer rounded-md border p-3 text-left duration-200 hover:opacity-80"
              onClick={onCreateNew}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <div className="font-semibold">{t('createNew')}</div>
                  <div className="text-muted-foreground line-clamp-2 text-sm font-light">
                    {t('createNewDesc')}
                  </div>
                </div>
                <div className="bg-secondary text-primary flex aspect-square size-12 items-center justify-center font-black">
                  <Signature className="size-6" />
                </div>
              </div>
            </button>

            {remoteArticles.length > 0 && (
              <div className="text-muted-foreground text-center text-sm font-light">-- or --</div>
            )}

            {/* 可滚动的文章列表区域 */}
            <div className="noScrollBar min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex h-32 w-full items-center justify-center">
                  <LoadingPlaceholder />
                </div>
              ) : (
                <div className="flex min-w-0 flex-col gap-2">
                  {displayArticles.length > 0 ? (
                    displayArticles.map((article) => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        onClick={() => handleSelect(article)}
                        isSelected={selectedArticle?.id === article.id}
                        showCheckmark
                        authorId={profile?.id}
                        onEdit={handleEdit}
                        onDeleted={handleDeleted}
                        className="hover:bg-muted/50 cursor-pointer transition-colors"
                      />
                    ))
                  ) : (
                    <div className="text-muted-foreground py-8 text-center text-sm">
                      {t('noArticles')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 编辑文章的 Modal */}
      {editingArticle && (
        <ArticleEditorModal
          open={editorOpen}
          onOpenChange={(open) => {
            setEditorOpen(open);
            if (!open) {
              setEditingArticle(null);
              fetchArticles();
            }
          }}
          article={editingArticle}
          onUpdated={() => {
            fetchArticles();
            setEditorOpen(false);
            setEditingArticle(null);
          }}
          onDeleted={() => {
            fetchArticles();
            setEditorOpen(false);
            setEditingArticle(null);
          }}
        />
      )}
    </>
  );
}
