import FloatBtns from '@/components/layout/FloatBtns';
import NavBar from '@/components/layout/navBar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useArticleActions } from '@/hooks/useArticleActions';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import { createArticle, getArticleFull, updateArticle } from '@/utils/articleApi';
import { finalize, presign, uploadToSignedUrl } from '@/utils/directUpload';
import { parseMarkdownMeta } from '@/utils/markdownParser';
import { maybeCompressToWebp } from '@/utils/uploadHelpers';
import { ArrowUpRight, Edit3, Eye, Heading1, Save, Signature, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

const CREATE_CACHE_KEY = 'article-create-cache';

export default function ArticleEditPage() {
  const { t } = useTranslation('translation', { keyPrefix: 'article.editor' });
  const { t: tActions } = useTranslation('translation', { keyPrefix: 'article.actions' });
  const { articleid } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(!!articleid);
  const [isPreview, setIsPreview] = useState(false);

  const isEditMode = !!articleid;

  // Load article if in edit mode
  useEffect(() => {
    if (articleid) {
      setIsInitialLoading(true);
      getArticleFull(articleid)
        .then((data) => {
          setContent(data.content || '');
        })
        .catch((error) => {
          toast.error(t('loadFailed'));
          // eslint-disable-next-line no-console
          console.error(error);
        })
        .finally(() => {
          setIsInitialLoading(false);
        });
    } else {
      // Create mode, load from cache
      try {
        const cache = localStorage.getItem(CREATE_CACHE_KEY);
        if (cache !== null) {
          setContent(cache);
        }
      } catch {}
    }
  }, [articleid, t]);

  const { isDeleting, handleDelete } = useArticleActions({
    articleId: articleid,
    onDeleted: () => {
      navigate(-1);
    },
  });

  const { title } = useMemo(() => parseMarkdownMeta(content), [content]);

  const clearCreateCache = () => {
    try {
      localStorage.removeItem(CREATE_CACHE_KEY);
    } catch {}
  };

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
      if (isEditMode && articleid) {
        await updateArticle(articleid, { content });
        toast.success(t('updateSuccess'));
        // Success, return to previous page
        navigate(-1);
      } else {
        const created = await createArticle({ content });
        toast.success(t('createSuccess'));
        clearCreateCache();
        // Success, navigate to article detail or return
        navigate(`/article/${created.id}`);
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message || (isEditMode ? t('updateFailed') : t('createFailed'));
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

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

    const uploads = fileArray.map((file) => {
      const id = crypto.randomUUID();
      const placeholder = `![${t('uploadingPlaceholder', { name: file.name })}](${id})`;
      return { file, id, placeholder };
    });

    const placeholdersText = uploads.map((u) => u.placeholder).join('\n');
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;

    setContent((prev) => {
      const pre = prev.substring(0, startPos);
      const suf = prev.substring(endPos);
      return pre + placeholdersText + suf;
    });

    for (const { file, placeholder } of uploads) {
      try {
        const compressed = await maybeCompressToWebp(file);
        const presignFiles = [{ filename: file.name, contentType: file.type, size: file.size }];
        const presignResult = await presign(presignFiles);
        const item = presignResult[0];

        await uploadToSignedUrl(item.original.putUrl, file);
        if (compressed && item.compressed) {
          await uploadToSignedUrl(item.compressed.putUrl, compressed);
        }

        const finalizePayload = {
          uuid: item.uuid,
          originalKey: item.original.key,
          compressedKey: compressed && item.compressed ? item.compressed.key : undefined,
          size: file.size,
          mimetype: file.type,
        };

        const [finalized] = await finalize([finalizePayload]);
        const finalUrl = finalized.compressUrl || finalized.url;
        const finalMarkdown = `![${file.name}](${finalUrl})`;

        setContent((prev) => prev.replace(placeholder, finalMarkdown));
      } catch (_err) {
        toast.error(t('uploadFailed', { name: file.name }));
        setContent((prev) =>
          prev.replace(placeholder, `![${t('uploadFailedPlaceholder', { name: file.name })}]()`)
        );
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

  if (isInitialLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    <ContainerWithSideBar
      sidebar={<MarkdownSidebar />}
      sidebarHeader={
        <div className="flex items-center gap-2 p-3 text-lg font-semibold">
          <div className="flex items-center gap-2">
            <Heading1 className="size-5" />
            {t('markdownSyntax')}
          </div>
        </div>
      }
    >
      <div className="flex h-dvh min-h-screen flex-col divide-y overflow-hidden pb-16 sm:pb-0">
        <NavBar
          title={isEditMode ? t('editTitle') : t('title')}
          icon={<Signature className="text-primary size-6" />}
        />

        {!isPreview ? (
          <Textarea
            className="flex-1 resize-none rounded-none border-none p-4 font-mono text-sm shadow-none focus-visible:ring-0"
            value={content}
            onChange={handleContentChange}
            onPaste={handlePaste}
            onDrop={handleDrop}
            placeholder={t('contentPlaceholder')}
            disabled={loading}
          />
        ) : (
          <div className="noScrollBar flex-1 overflow-auto p-4">
            {content ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                {t('previewPlaceholder')}
              </div>
            )}
          </div>
        )}

        <FloatBtns>
          <Button
            size="icon"
            className="rounded-md shadow-md"
            onClick={() => navigate(-1)}
            disabled={loading || isDeleting}
            title={t('cancel')}
          >
            <X className="size-4" />
          </Button>
          {isEditMode && (
            <Button
              size="icon"
              className="rounded-md shadow-md"
              onClick={handleDelete}
              disabled={loading || isDeleting}
              title={isDeleting ? tActions('deleting') : tActions('delete')}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            size="icon"
            className="rounded-md shadow-md"
            onClick={() => setIsPreview(!isPreview)}
            title={isPreview ? t('editLabel') : t('previewLabel')}
          >
            {isPreview ? <Edit3 className="size-4" /> : <Eye className="size-4" />}
          </Button>
          <Button
            size="icon"
            className="rounded-md shadow-md"
            onClick={onSubmit}
            disabled={loading || isDeleting}
            title={isEditMode ? t('update') : t('save')}
          >
            <Save className="size-4" />
          </Button>
        </FloatBtns>
      </div>
    </ContainerWithSideBar>
  );
}

const MarkdownSidebar = () => {
  const { t } = useTranslation('translation', { keyPrefix: 'article.editor' });

  return (
    <div className="flex flex-col">
      <div className="text-muted-foreground space-y-6 p-4 text-sm">
        <div>
          <div className="text-foreground mb-2 font-medium">{t('syntaxBoldItalic')}</div>
          <code className="bg-muted rounded px-1.5 py-1">**{t('syntaxBoldText')}**</code> 和{' '}
          <code className="bg-muted rounded px-1.5 py-1">*{t('syntaxItalicText')}*</code>
        </div>
        <div>
          <div className="text-foreground mb-2 font-medium">{t('syntaxHeader')}</div>
          <code className="bg-muted rounded px-1.5 py-1"># {t('syntaxH1')}</code>
          <br />
          <code className="bg-muted mt-1 inline-block rounded px-1.5 py-1">## {t('syntaxH2')}</code>
        </div>
        <div>
          <div className="text-foreground mb-2 font-medium">{t('syntaxLinkImage')}</div>
          <code className="bg-muted rounded px-1.5 py-1">[{t('syntaxLinkText')}](URL)</code>
          <br />
          <code className="bg-muted mt-1 inline-block rounded px-1.5 py-1">
            ![{t('syntaxImageDesc')}]({t('syntaxImageLink')})
          </code>
          <p className="mt-2 text-xs italic opacity-70">{t('syntaxImageTip')}</p>
        </div>
        <div>
          <div className="text-foreground mb-2 font-medium">{t('syntaxList')}</div>
          <code className="bg-muted rounded px-1.5 py-1">- {t('syntaxListItem')}</code>
          <br />
          <code className="bg-muted mt-1 inline-block rounded px-1.5 py-1">
            1. {t('syntaxListItem')}
          </code>
        </div>
        <div>
          <div className="text-foreground mb-2 font-medium">{t('syntaxQuoteCode')}</div>
          <code className="bg-muted rounded px-1.5 py-1">&gt; {t('syntaxQuote')}</code>
          <br />
          <code className="bg-muted mt-1 inline-block rounded px-1.5 py-1">
            ``` {t('syntaxCodeBlock')}
          </code>
        </div>

        <a
          href="https://docs.github.com/zh/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 hover:underline"
        >
          {t('syntaxFullGuide')}
          <ArrowUpRight className="size-4" />
        </a>
      </div>
    </div>
  );
};
