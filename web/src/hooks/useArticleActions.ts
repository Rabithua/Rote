import { deleteArticle } from '@/utils/articleApi';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface UseArticleActionsOptions {
  articleId?: string;
  onDeleted?: () => void;
  onEdit?: () => void;
}

/**
 * 可复用的文章操作 hook
 * 处理文章的编辑、复制链接、删除等操作
 */
export function useArticleActions({ articleId, onDeleted, onEdit }: UseArticleActionsOptions) {
  const { t } = useTranslation('translation', { keyPrefix: 'article.actions' });
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCopyLink = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (articleId) {
        const url = `${window.location.origin}/article/${articleId}`;
        navigator.clipboard.writeText(url);
        toast.success(t('linkCopied'));
      }
    },
    [articleId, t]
  );

  const handleEdit = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      onEdit?.();
    },
    [onEdit]
  );

  const handleDelete = useCallback(
    async (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!articleId) return;

      if (!confirm(t('deleteConfirm'))) {
        return;
      }

      setIsDeleting(true);
      try {
        await deleteArticle(articleId);
        toast.success(t('deleteSuccess'));
        onDeleted?.();
      } catch (error: any) {
        const message = error?.response?.data?.message || t('deleteFailed');
        toast.error(message);
      } finally {
        setIsDeleting(false);
      }
    },
    [articleId, onDeleted, t]
  );

  return {
    isDeleting,
    handleCopyLink,
    handleEdit,
    handleDelete,
    t,
  };
}
