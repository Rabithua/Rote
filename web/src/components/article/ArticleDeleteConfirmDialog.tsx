import { useTranslation } from 'react-i18next';

import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';

interface ArticleDeleteConfirmDialogProps {
  isDeleting: boolean;
  open: boolean;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}

export function ArticleDeleteConfirmDialog({
  isDeleting,
  open,
  onConfirm,
  onOpenChange,
}: ArticleDeleteConfirmDialogProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'article.actions' });

  return (
    <DeleteConfirmDialog
      open={open}
      isDeleting={isDeleting}
      title={t('deleteConfirmTitle')}
      description={t('deleteConfirmDescription')}
      cancelLabel={t('cancelDelete')}
      confirmLabel={t('confirmDelete')}
      deletingLabel={t('deleting')}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
    />
  );
}
