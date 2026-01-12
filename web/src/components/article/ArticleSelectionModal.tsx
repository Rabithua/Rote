import { ArticleCard } from '@/components/article/ArticleCard';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { Article } from '@/types/main';
import { Signature } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articles: Article[];
  // 当前选中的文章 ID
  selectedId: string | null;
  // 选择文章后的回调（会自动关闭 dialog）
  onSelect: (articleId: string) => void;
  onCreateNew: () => void;
}

export function ArticleSelectionModal({
  open,
  onOpenChange,
  articles,
  selectedId,
  onSelect,
  onCreateNew,
}: Props) {
  const { t } = useTranslation('translation', { keyPrefix: 'article.selection' });

  const handleSelect = (articleId: string) => {
    onSelect(articleId);
    onOpenChange(false);
  };

  return (
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

          {articles.length > 0 && (
            <div className="text-muted-foreground text-center text-sm font-light">-- or --</div>
          )}

          {/* 可滚动的文章列表区域 */}
          <div className="noScrollBar min-h-0 flex-1 overflow-y-auto">
            <div className="flex min-w-0 flex-col gap-2">
              {articles.length > 0 ? (
                articles.map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    onClick={() => handleSelect(article.id)}
                    isSelected={selectedId === article.id}
                    showCheckmark
                  />
                ))
              ) : (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  {t('noArticles')}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
