import type { Article, ArticleSummary } from '@/types/main';
import { extractFirstImageFromMarkdown, parseMarkdownMeta } from '@/utils/markdown';
import { Check, Newspaper } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

interface ArticleCardProps {
  article: Article | ArticleSummary;
  // 当 article 为摘要且不包含 id 时，可通过该字段提供
  articleId?: string;
  onClick?: () => void;
  isSelected?: boolean;
  showCheckmark?: boolean;
  className?: string;
  // 是否启用内置的文章查看器
  enableViewer?: boolean;
  // 关联的笔记 ID，用于文章查看器
  noteId?: string;
}

export function ArticleCard({
  article,
  articleId,
  onClick,
  isSelected = false,
  showCheckmark = false,
  className = '',
  enableViewer = false,
}: ArticleCardProps) {
  const navigate = useNavigate();
  const resolvedArticleId = articleId ?? article.id;

  // 从 content 中解析 title、summary 和封面图片
  const { title, summary, coverImage } = useMemo(() => {
    const content = 'content' in article ? article.content : '';
    const meta = parseMarkdownMeta(content || '');
    const coverImage = extractFirstImageFromMarkdown(content || '');
    return { ...meta, coverImage };
  }, [article]);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (enableViewer && resolvedArticleId) {
      navigate(`/article/${resolvedArticleId}`);
    }
  };

  return (
    <>
      <div
        className={`hover:bg-secondary bg-secondary/50 flex cursor-pointer items-stretch overflow-hidden rounded-md border duration-200 ${
          isSelected ? 'bg-primary/10' : ''
        } ${className}`}
        onClick={handleClick}
      >
        <div className="bg-foreground/5 flex size-18 shrink-0 items-center justify-center">
          {coverImage ? (
            <img
              src={coverImage}
              alt=""
              className="size-full object-cover"
              onError={(e) => {
                // 图片加载失败时隐藏，显示后备图标
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div
            className={`text-primary flex size-full items-center justify-center ${
              coverImage ? 'hidden' : ''
            }`}
          >
            <Newspaper className="size-7" />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2">
          <div className="truncate text-sm font-semibold">{title}</div>
          {summary && (
            <div className="text-muted-foreground line-clamp-1 text-xs font-light">{summary}</div>
          )}
        </div>
        {showCheckmark && isSelected && <Check className="text-primary size-6 shrink-0" />}
      </div>

      {/* 文章详情页已独立，不再弹窗展示 */}
    </>
  );
}
