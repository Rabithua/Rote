import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useArticleActions } from '@/hooks/useArticleActions';
import type { Article } from '@/types/main';
import { createArticle, updateArticle } from '@/utils/articleApi';
import { finalize, presign, uploadToSignedUrl } from '@/utils/directUpload';
import { parseMarkdownMeta } from '@/utils/markdownParser';
import { maybeCompressToWebp } from '@/utils/uploadHelpers';
import { Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
// 新建模式缓存 key
const CREATE_CACHE_KEY = 'article-create-cache';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (article: Article) => void;
  // 编辑模式：传入 article 即为编辑模式
  article?: Article | null;
  onUpdated?: (article: Article) => void;
  // 删除成功后的回调
  onDeleted?: () => void;
}

export function ArticleEditorModal({
  open,
  onOpenChange,
  onCreated,
  article,
  onUpdated,
  onDeleted,
}: Props) {
  const { t } = useTranslation('translation', { keyPrefix: 'article.editor' });
  const { t: tActions } = useTranslation('translation', { keyPrefix: 'article.actions' });
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  // 使用共享 hook 处理删除操作
  const { isDeleting, handleDelete } = useArticleActions({
    articleId: article?.id,
    onDeleted: () => {
      onOpenChange(false);
      onDeleted?.();
    },
  });

  // 判断是否为编辑模式
  const isEditMode = !!article;

  // 从Markdown内容自动解析标题和摘要
  const { title, summary: _summary } = useMemo(() => parseMarkdownMeta(content), [content]);

  // 清除新建缓存
  const clearCreateCache = () => {
    try {
      localStorage.removeItem(CREATE_CACHE_KEY);
    } catch {}
  };

  // 重置内容（不清理缓存）
  const reset = () => {
    setContent('');
  };

  // 使用 ref 追踪上一次的 open 和 article 状态，在渲染时同步更新 content
  const prevOpenRef = useRef(open);
  const prevArticleIdRef = useRef(article?.id);

  // 在渲染时直接调整 state，避免 useEffect 中的 prop 变化触发 state 更新
  if (open && !prevOpenRef.current) {
    // Dialog 刚打开
    if (!article) {
      // 新建模式，尝试恢复缓存
      try {
        const cache = localStorage.getItem(CREATE_CACHE_KEY);
        if (cache !== null) {
          setContent(cache);
        } else {
          setContent('');
        }
      } catch {
        setContent('');
      }
    } else {
      // 编辑模式，直接加载文章内容
      setContent(article.content || '');
    }
  } else if (open && article && article.id !== prevArticleIdRef.current) {
    // 切换到不同的文章
    setContent(article.content || '');
  } else if (!open && prevOpenRef.current) {
    // Dialog 关闭时重置
    reset();
  }
  prevOpenRef.current = open;
  prevArticleIdRef.current = article?.id;

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
        // 仅新建成功后清理缓存
        clearCreateCache();
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

  // 内容变更时，仅新建模式下写入缓存
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    if (!isEditMode) {
      try {
        localStorage.setItem(CREATE_CACHE_KEY, val);
      } catch {}
    }
  };

  const uploadAndInsert = async (files: FileList | File[], textarea: HTMLTextAreaElement) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    // 1. 生成占位符并插入
    // 更安全的做法是：只负责生成占位符字符串，一次性插入到 textarea，然后利用 replace 替换占位符
    // 为避免覆盖用户在此期间的输入，替换时应使用 setContent(prev => ...)

    const uploads = fileArray.map((file) => {
      const id = crypto.randomUUID();
      const placeholder = `![Uploading ${file.name}...](${id})`;
      return { file, id, placeholder };
    });

    // 插入所有占位符
    const placeholdersText = uploads.map((u) => u.placeholder).join('\n');
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;

    // 初始插入
    setContent((prev) => {
      // 注意：这里使用的是调用 insert 时的位置。如果用户在上传过程中移动光标，这部分逻辑只在初始发生一次，没问题。
      const pre = prev.substring(0, startPos);
      const suf = prev.substring(endPos);
      return pre + placeholdersText + suf;
    });

    // 2. 并发上传
    for (const { file, placeholder } of uploads) {
      try {
        // 压缩
        const compressed = await maybeCompressToWebp(file);

        // 预签名
        const presignFiles = [{ filename: file.name, contentType: file.type, size: file.size }];
        // 如果有压缩图，虽然目前 presign 接口内部会自动处理 compressedKey（如果是预定义的后缀），
        // 但根据 `attachment.ts` 的逻辑，它会返回 original 和 compressed (固定 image/webp) 的 putUrl
        // 我们只需要传 original 的信息给 presign 即可。

        const presignResult = await presign(presignFiles);
        const item = presignResult[0];

        // 上传原图
        await uploadToSignedUrl(item.original.putUrl, file);

        // 上传压缩图（如果有）
        if (compressed && item.compressed) {
          await uploadToSignedUrl(item.compressed.putUrl, compressed);
        }

        // Finalize
        const finalizePayload = {
          uuid: item.uuid,
          originalKey: item.original.key,
          compressedKey: compressed && item.compressed ? item.compressed.key : undefined,
          size: file.size,
          mimetype: file.type,
          // hash: ... // 前端暂未计算 hash
        };

        const [finalized] = await finalize([finalizePayload]);

        // 替换占位符
        const finalUrl = finalized.compressUrl || finalized.url;
        const finalMarkdown = `![${file.name}](${finalUrl})`;

        setContent((prev) => prev.replace(placeholder, finalMarkdown));
      } catch (_err) {
        // console.error('Upload failed', err);
        toast.error(`Failed to upload ${file.name}`);
        // 失败时移除占位符或保留供用户查看？这里选择替换为错误提示
        setContent((prev) => prev.replace(placeholder, `![Upload Failed: ${file.name}]()`));
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files.length > 0) {
      e.preventDefault();
      uploadAndInsert(e.clipboardData.files, e.currentTarget);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length > 0) {
      uploadAndInsert(e.dataTransfer.files, e.currentTarget);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="hidden px-6 pt-4 text-lg font-semibold">
        {isEditMode ? t('editTitle') : t('title')}
      </DialogTitle>
      <DialogContent className="h-[90vh] w-screen max-w-4xl p-2 sm:max-w-5xl">
        <div className="flex h-full flex-col gap-4 overflow-scroll">
          {/* 左右布局：左侧编辑器，右侧预览 */}
          <div className="flex flex-1 gap-4 overflow-scroll">
            {/* 左侧：Markdown编辑器 */}
            <div className="flex w-full flex-col p-1 md:w-1/2">
              <div className="mb-2 shrink-0 text-xs">{t('editorLabel')}</div>
              <Textarea
                className="scrollbar-thin min-h-0 flex-1 resize-none font-mono text-sm"
                value={content}
                onChange={handleContentChange}
                onPaste={handlePaste}
                onDrop={handleDrop}
                placeholder={t('contentPlaceholder')}
                disabled={loading}
              />
            </div>

            {/* 右侧：Markdown预览 */}
            <div className="hidden w-1/2 flex-col overflow-hidden p-1 md:flex">
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

          <div className="flex shrink-0 justify-between gap-2 border-t pt-3">
            {/* 左侧：删除按钮（仅编辑模式） */}
            <div>
              {isEditMode && (
                <Button
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={loading || isDeleting}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="mr-1 size-4" />
                  {isDeleting ? tActions('deleting') : tActions('delete')}
                </Button>
              )}
            </div>
            {/* 右侧：取消和保存按钮 */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading || isDeleting}
              >
                {t('cancel')}
              </Button>
              <Button onClick={onSubmit} disabled={loading || isDeleting}>
                {isEditMode ? t('update') : t('save')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
