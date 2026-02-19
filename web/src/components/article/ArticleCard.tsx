import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useArticleActions } from '@/hooks/useArticleActions';
import { profileAtom } from '@/state/profile';
import type { Article, ArticleSummary } from '@/types/main';
import { extractFirstImageFromMarkdown, parseMarkdownMeta } from '@/utils/markdown';
import { useAtomValue } from 'jotai';
import { Check, Edit, Link, MoreVertical, Newspaper, Trash2 } from 'lucide-react';
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
  // 文章作者 ID，用于判断是否显示操作菜单
  authorId?: string;
  // 编辑文章的回调
  onEdit?: (article: Article | ArticleSummary) => void;
  // 删除成功后的回调
  onDeleted?: () => void;
  // 是否显示下拉菜单
  showMenu?: boolean;
}

export function ArticleCard({
  article,
  articleId,
  onClick,
  isSelected = false,
  showCheckmark = false,
  className = '',
  enableViewer = false,
  authorId,
  onEdit,
  onDeleted,
  showMenu = true,
}: ArticleCardProps) {
  const profile = useAtomValue(profileAtom);
  const resolvedArticleId = articleId ?? article.id;
  const navigate = useNavigate();

  // 使用共享 hook 处理文章操作
  const { isDeleting, handleCopyLink, handleDelete, t } = useArticleActions({
    articleId: resolvedArticleId,
    onDeleted,
    onEdit: onEdit ? () => onEdit(article) : undefined,
  });

  // 判断当前用户是否为作者
  const isAuthor = profile && authorId && profile.id === authorId;

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

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(article);
    } else if (resolvedArticleId) {
      // 如果没有 onEdit 回调，跳转到文章详情页编辑
      navigate(`/article/${resolvedArticleId}`);
    }
  };

  return (
    <>
      <div
        className={`hover:bg-secondary bg-secondary/50 relative flex cursor-pointer items-stretch overflow-hidden rounded-md border duration-200 ${
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

        {/* 下拉菜单 - 仅作者可见 */}
        {showMenu && isAuthor && (
          <div className="absolute top-1 right-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="hover:bg-background/80 rounded p-1"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEditClick}>
                  <Edit className="mr-2 size-4" />
                  {t('edit')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyLink}>
                  <Link className="mr-2 size-4" />
                  {t('copyLink')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  variant="destructive"
                  disabled={isDeleting}
                >
                  <Trash2 className="mr-2 size-4" />
                  {isDeleting ? t('deleting') : t('delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </>
  );
}
