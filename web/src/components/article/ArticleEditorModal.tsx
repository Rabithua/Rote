import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { Article } from '@/types/main';
import { createArticle, updateArticle } from '@/utils/articleApi';
import { parseMarkdownMeta } from '@/utils/markdownParser';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (article: Article) => void;
  // 编辑模式：传入 article 即为编辑模式
  article?: Article | null;
  onUpdated?: (article: Article) => void;
}

export function ArticleEditorModal({ open, onOpenChange, onCreated, article, onUpdated }: Props) {
  const { t } = useTranslation('translation', { keyPrefix: 'article.editor' });
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  // 判断是否为编辑模式
  const isEditMode = !!article;

  // 从Markdown内容自动解析标题和摘要
  const { title, summary: _summary } = useMemo(() => parseMarkdownMeta(content), [content]);

  const reset = () => {
    setContent('');
  };

  useEffect(() => {
    if (open && article) {
      // 编辑模式：加载文章内容
      setContent(article.content || '');
    } else if (!open) {
      reset();
    }
  }, [open, article]);

  const onSubmit = async () => {
    if (!content.trim()) {
      toast.error(t('emptyContent'));
      return;
    }
    if (!title) {
      toast.error(t('needTitle'));
      return;
    }
    setLoading(true);
    try {
      if (isEditMode && article) {
        // 编辑模式：更新文章
        const updated = await updateArticle(article.id, { content });
        toast.success(t('updateSuccess'));
        onUpdated?.(updated);
      } else {
        // 创建模式：创建文章
        const created = await createArticle({ content });
        toast.success(t('createSuccess'));
        onCreated?.(created);
      }
      reset();
      onOpenChange(false);
    } catch (error: any) {
      const message =
        error?.response?.data?.message || (isEditMode ? t('updateFailed') : t('createFailed'));
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="hidden px-6 pt-4 text-lg font-semibold">
        {isEditMode ? t('editTitle') : t('title')}
      </DialogTitle>
      <DialogContent className="h-[90vh] w-screen max-w-4xl rounded-none pt-6 sm:max-w-5xl">
        <div className="flex h-full flex-col gap-4 overflow-hidden pt-6">
          {/* 左右布局：左侧编辑器，右侧预览 */}
          <div className="flex flex-1 gap-4 overflow-hidden">
            {/* 左侧：Markdown编辑器 */}
            <div className="flex w-full flex-col md:w-1/2">
              <div className="mb-2 shrink-0 text-xs">{t('editorLabel')}</div>
              <Textarea
                className="scrollbar-thin min-h-0 flex-1 resize-none border font-mono text-sm shadow-none ring-0 outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('contentPlaceholder')}
                disabled={loading}
              />
            </div>

            {/* 右侧：Markdown预览 */}
            <div className="hidden w-1/2 flex-col overflow-hidden md:flex">
              <div className="mb-2 shrink-0 text-xs">{t('previewLabel')}</div>
              <div className="scrollbar-thin bg-muted/30 min-h-0 flex-1 overflow-auto rounded-md border p-4">
                {content ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">{t('previewPlaceholder')}</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {t('cancel')}
            </Button>
            <Button onClick={onSubmit} disabled={loading}>
              {isEditMode ? t('update') : t('save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
