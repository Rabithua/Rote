import { ArticleCard } from '@/components/article/ArticleCard';
import { TagSelector } from '@/components/others/TagSelector';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { Article, Attachment, Rote } from '@/types/main';
import { del } from '@/utils/api';
import { NoteSubmission } from '@/features/attachments/noteSubmission';
import type { EditorDraft } from '@/state/editor';
import { getUploadErrorMessage } from '@/utils/directUpload';
import { useSiteStatus } from '@/hooks/useSiteStatus';
import { usePermissions } from '@/hooks/usePermissions';

import { getAttachmentMediaKind } from '@/utils/directUpload';
import {
  DEFAULT_MAX_VIDEO_UPLOAD_SIZE_MB,
  IMAGE_ACCEPT,
  VIDEO_ACCEPT,
  isImageFile,
  isVideoFile,
} from '@/utils/uploadHelpers';
import { useAtom, type PrimitiveAtom } from 'jotai';
import debounce from 'lodash/debounce';
import { Archive, BookOpen, Globe2, Globe2Icon, PinIcon, Send, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import 'react-photo-view/dist/react-photo-view.css';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getArticleFull } from '@/utils/articleApi';

import { ArticleSelectionModal } from '../article/ArticleSelectionModal';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import AttachmentList from './AttachmentList';

// sessionStorage key for article creation context
export const ARTICLE_CREATION_CONTEXT_KEY = 'article-creation-context';

type RoteAtomType = PrimitiveAtom<EditorDraft>;

function RoteEditor({ roteAtom, callback }: { roteAtom: RoteAtomType; callback?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.roteInputSimple',
  });

  const [submiting, setSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Set<File>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<Map<File, number>>(new Map());
  const submittingRef = useRef(false);
  const submission = useRef(new NoteSubmission());
  const [rote, setRote] = useAtom(roteAtom);
  const { data: siteStatus } = useSiteStatus();
  const { capabilities } = usePermissions();
  const roteMaxLetter = siteStatus?.frontendConfig?.roteMaxLetter;
  const canUpload =
    !!siteStatus?.storage?.r2Configured &&
    siteStatus?.ui?.allowUploadFile !== false &&
    capabilities?.['attachment.upload'].allowed === true;
  const canUploadVideo = canUpload && capabilities?.['attachment.video.upload'].allowed === true;
  const canUploadDirectlyFromBrowser = siteStatus?.ui?.attachmentDirectBrowserUpload === true;
  const maxVideoUploadSizeMB =
    siteStatus?.ui?.maxVideoUploadSizeMB || DEFAULT_MAX_VIDEO_UPLOAD_SIZE_MB;
  const maxVideoUploadSizeBytes = maxVideoUploadSizeMB * 1024 * 1024;

  const [localContent, setLocalContent] = useState(rote.content);
  const [articleSelectionOpen, setArticleSelectionOpen] = useState(false);

  const attachmentMediaKinds = useMemo(
    () => rote.attachments.map((attachment) => getAttachmentMediaKind(attachment)).filter(Boolean),
    [rote.attachments]
  );
  const hasVideoAttachment = attachmentMediaKinds.includes('video');
  const imageAttachmentCount = attachmentMediaKinds.filter(
    (kind) => kind === 'image' || kind === 'livePhoto'
  ).length;
  const canAddMoreAttachments = !hasVideoAttachment && imageAttachmentCount < 9;
  const uploadAccept = hasVideoAttachment
    ? VIDEO_ACCEPT
    : canUploadVideo
      ? `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`
      : IMAGE_ACCEPT;

  // 选中的文章 ID（一对一，只能有一个）

  // 重置编辑器状态
  const resetEditor = useCallback(() => {
    const emptyRote = {
      content: '',
      tags: [],
      attachments: [],
      pin: false,
      archived: false,
      state: 'private' as const,
      reactions: [],
      article: null,
      articleId: null,
      id: '',
      author: {
        username: '',
        nickname: '',
        avatar: '',
        emailVerified: false,
      },
      createdAt: '',
      updatedAt: '',
    };

    setRote(emptyRote);
    setLocalContent('');
    setUploadingFiles(new Set());
    setUploadProgress(new Map());
    submission.current = new NoteSubmission();
  }, [setRote]);

  useEffect(() => {
    if (rote.content !== localContent) {
      setLocalContent(rote.content);
    }
  }, [rote.content]);

  const debouncedUpdateContent = useMemo(
    () =>
      debounce((content: string) => {
        setRote((prevRote: Rote) => ({
          ...prevRote,
          content,
        }));
      }, 300),
    [setRote]
  );

  useEffect(() => () => debouncedUpdateContent.cancel(), [debouncedUpdateContent]);

  const handleContentChange = useCallback(
    (content: string) => {
      setLocalContent(content);
      debouncedUpdateContent(content);
    },
    [debouncedUpdateContent]
  );

  // 选择文章（一对一绑定）
  const selectArticle = useCallback(
    (article: Article) => {
      setRote((prev: Rote) => ({
        ...prev,
        articleId: article.id,
        article: article,
      }));
    },
    [setRote]
  );

  // 移除绑定的文章
  const removeArticle = useCallback(() => {
    setRote((prev: Rote) => ({
      ...prev,
      articleId: null,
      article: null,
    }));
  }, [setRote]);

  // 检测从文章创建页面返回后，自动关联新创建的文章
  useEffect(() => {
    const checkNewArticle = async () => {
      try {
        const contextStr = sessionStorage.getItem(ARTICLE_CREATION_CONTEXT_KEY);
        if (!contextStr) return;

        const context = JSON.parse(contextStr);
        // 检查是否有新创建的文章且返回路径匹配当前路径
        if (context.newArticleId && context.returnPath === location.pathname) {
          // 清除上下文
          sessionStorage.removeItem(ARTICLE_CREATION_CONTEXT_KEY);

          // 获取文章详情并关联
          const article = await getArticleFull(context.newArticleId);
          selectArticle(article);
          toast.success(t('articleLinked'));
        }
      } catch {
        // 解析失败或获取文章失败，清除上下文
        sessionStorage.removeItem(ARTICLE_CREATION_CONTEXT_KEY);
      }
    };

    checkNewArticle();
  }, [location.pathname, selectArticle, t]);

  const deleteFile = useCallback(
    async (indexToRemove: number) => {
      if (submittingRef.current) return;
      const item = rote.attachments[indexToRemove];
      try {
        if (!(item instanceof File)) await del(`/attachments/${item.id}`);
        setRote((prev) => ({ ...prev, attachments: prev.attachments.filter((a) => a !== item) }));
      } catch (error) {
        toast.error(getUploadErrorMessage(error));
      }
    },
    [rote.attachments, setRote]
  );

  const addFiles = useCallback(
    (files: File[]) => {
      if (!files.length || submittingRef.current) return;
      const existingMediaKinds = rote.attachments.map(getAttachmentMediaKind).filter(Boolean);
      const existingHasVideo = existingMediaKinds.includes('video');
      const existingImageCount = existingMediaKinds.filter(
        (kind) => kind === 'image' || kind === 'livePhoto'
      ).length;

      const fileKinds = files.map((file) => {
        if (isImageFile(file)) return 'image';
        if (isVideoFile(file)) return 'video';
        return null;
      });
      const hasUnsupportedFile = fileKinds.some((kind) => kind === null);
      const hasImageSelection = fileKinds.includes('image');
      const hasVideoSelection = fileKinds.includes('video');

      if (hasUnsupportedFile) {
        toast.error(t('unsupportedFileType'));
        return;
      }
      if (hasImageSelection && hasVideoSelection) {
        toast.error(t('mixedMediaNotAllowed'));
        return;
      }
      if (hasVideoSelection && !canUploadVideo) {
        toast.error(t('videoUploadDisabled'));
        return;
      }
      if (hasVideoSelection && existingImageCount > 0) {
        toast.error(t('mixedMediaNotAllowed'));
        return;
      }
      if (hasImageSelection && existingHasVideo) {
        toast.error(t('mixedMediaNotAllowed'));
        return;
      }
      if (hasVideoSelection && (files.length > 1 || existingHasVideo)) {
        toast.error(t('singleVideoOnly'));
        return;
      }
      if (hasImageSelection && existingImageCount + files.length > 9) {
        toast.error(t('imageLimitExceeded', { count: 9 }));
        return;
      }
      if (hasVideoSelection && files.some((file) => file.size > maxVideoUploadSizeBytes)) {
        toast.error(t('videoTooLarge', { size: maxVideoUploadSizeMB }));
        return;
      }

      setRote((prev) => ({ ...prev, attachments: [...prev.attachments, ...files] }));
    },
    [canUploadVideo, maxVideoUploadSizeBytes, maxVideoUploadSizeMB, rote.attachments, setRote, t]
  );

  // Owner decision (2026-09-11): ordinary submit + error toast only. Do not
  // restore attachment failure locks/recovery panels without explicit owner approval.
  const submit = useCallback(async () => {
    if (submittingRef.current) return;
    if (!localContent.trim()) {
      toast.error(t('error.emptyContent'));
      return;
    }
    submittingRef.current = true;
    debouncedUpdateContent.cancel();
    setSubmitting(true);
    const createId = rote.createId || crypto.randomUUID();
    const draft = { ...rote, content: localContent.trim(), createId };
    setRote(draft);
    const files = draft.attachments.filter((item): item is File => item instanceof File);
    const toastId = toast.loading(t('sending'));
    setUploadingFiles(new Set(files));
    try {
      const result = await submission.current.submit(
        draft,
        createId,
        {
          browserDirectUpload: canUploadDirectlyFromBrowser,
          batchFinalize: siteStatus?.ui?.attachmentBatchFinalize === true,
        },
        (note) => setRote((prev) => ({ ...prev, id: note.id })),
        (file, progress) => setUploadProgress((prev) => new Map(prev).set(file, progress))
      );
      toast.success(t('sendSuccess'), { id: toastId });
      if (callback) {
        resetEditor();
        callback();
      } else {
        setRote(result);
        setLocalContent(result.content);
        submission.current = new NoteSubmission();
      }
    } catch (error) {
      toast.error(`${t('sendFailed')}: ${getUploadErrorMessage(error)}`, { id: toastId });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setUploadingFiles(new Set());
      setUploadProgress(new Map());
    }
  }, [
    localContent,
    rote,
    t,
    callback,
    setRote,
    resetEditor,
    debouncedUpdateContent,
    canUploadDirectlyFromBrowser,
    siteStatus?.ui?.attachmentBatchFinalize,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        submit();
      }
    },
    [submit]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob && blob.size > 0) {
            const file = new File([blob], `pasted-image-${Date.now()}.png`, {
              type: blob.type,
            });
            files.push(file);
          }
        }
      }
      addFiles(files);
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      const files = e.dataTransfer.files;

      if (files.length > 0) {
        addFiles(Array.from(files));
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
  }, []);

  const updateTags = useCallback(
    (value: string[]) => {
      setRote((prevRote) => ({
        ...prevRote,
        tags: value.map((tag) => tag.trim()),
      }));
    },
    [setRote]
  );

  const removeTag = useCallback(
    (tagToRemove: string) => {
      setRote((prevRote) => ({
        ...prevRote,
        tags: prevRote.tags.filter((tag) => tag !== tagToRemove),
      }));
    },
    [setRote]
  );

  const toggleProperty = useCallback(
    (property: keyof Pick<Rote, 'pin' | 'archived'>) => {
      setRote((prevRote) => ({
        ...prevRote,
        [property]: !prevRote[property],
      }));
    },
    [setRote]
  );

  const toggleState = useCallback(() => {
    setRote((prevRote) => ({
      ...prevRote,
      state: prevRote.state === 'public' ? 'private' : 'public',
    }));
  }, [setRote]);

  const handleFileAdd = useCallback(
    (newFileList: File[]) => {
      addFiles(newFileList);
    },
    [addFiles]
  );

  // 处理附件重新排序
  const handleAttachmentReorder = useCallback(
    (reorderedAttachments: (File | Attachment)[]) => {
      if (submittingRef.current) return;
      setRote((prevRote) => ({
        ...prevRote,
        attachments: reorderedAttachments,
      }));
    },
    [setRote]
  );

  const showPublicWarning = useMemo(() => rote.state === 'public', [rote.state]);

  return (
    <div
      className="bg-background grow space-y-2 overflow-hidden"
      inert={submiting}
      aria-busy={submiting}
    >
      <Textarea
        value={localContent}
        placeholder={t('contentPlaceholder')}
        className={`inputOrTextAreaInit max-h-[60dvh] min-h-40 break-all lg:text-lg`}
        maxLength={roteMaxLetter}
        disabled={submiting}
        onInput={(e: React.FormEvent<HTMLTextAreaElement>) => {
          handleContentChange(e.currentTarget.value);
        }}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onKeyDown={handleKeyDown}
        rows={3}
      />

      {canUpload && (
        <AttachmentList
          attachments={rote.attachments}
          uploadingFiles={uploadingFiles}
          uploadProgress={uploadProgress}
          onDelete={deleteFile}
          onReorder={handleAttachmentReorder}
          onFileAdd={handleFileAdd}
          roteId={rote.id}
          disabled={submiting}
          accept={uploadAccept}
          canAddMore={canAddMoreAttachments}
        />
      )}

      {/* 绑定的文章 - 一对一，只在有绑定时显示 */}
      {rote.articleId && (
        <div className="space-y-2 overflow-hidden">
          {(() => {
            const article = rote.article;
            if (!article) return null;
            return (
              <div key={article.id} className="group relative overflow-hidden">
                <ArticleCard
                  article={article}
                  articleId={article.id}
                  className="w-full"
                  enableViewer
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2 size-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeArticle();
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            );
          })()}
        </div>
      )}

      <div className={`animate-show flex shrink-0 flex-wrap gap-2 opacity-0 duration-300`}>
        {rote.tags.map((item: string) => (
          <div
            className="bg-foreground/3 flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-center text-xs duration-300 hover:scale-95"
            onClick={() => removeTag(item)}
            key={item}
          >
            {item}
            <X className="text-primary size-3 duration-300 hover:scale-95" />
          </div>
        ))}
      </div>

      <div className="noScrollBar flex flex-wrap items-center gap-1 overflow-x-scroll sm:gap-2">
        <TagSelector
          tags={rote.tags}
          setTags={updateTags}
          callback={(_value: string[]) => {
            // TagSelector callback - could be used for debugging or additional logic
          }}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <PinIcon
              className={`size-8 cursor-pointer rounded-md p-2 duration-300 ${
                rote.pin ? 'bg-foreground/3' : ''
              }`}
              onClick={() => toggleProperty('pin')}
            />
          </TooltipTrigger>
          <TooltipContent sideOffset={4}>{t('pin')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Archive
              className={`size-8 cursor-pointer rounded-md p-2 duration-300 ${
                rote.archived ? 'bg-foreground/3' : ''
              }`}
              onClick={() => toggleProperty('archived')}
            />
          </TooltipTrigger>
          <TooltipContent sideOffset={4}>{t('archive')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <BookOpen
              className={`size-8 cursor-pointer rounded-md p-2 duration-300 ${
                rote.articleId ? 'bg-foreground/3' : ''
              }`}
              onClick={() => setArticleSelectionOpen(true)}
            />
          </TooltipTrigger>
          <TooltipContent sideOffset={4}>{t('articleReference')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Globe2
              className={`size-8 cursor-pointer rounded-md p-2 duration-300 ${
                rote.state === 'public' ? 'bg-foreground/3' : ''
              }`}
              onClick={toggleState}
            />
          </TooltipTrigger>
          <TooltipContent sideOffset={4}>{t(`stateOptions.${rote.state}`)}</TooltipContent>
        </Tooltip>

        <Button
          type="button"
          className="ml-auto flex items-center gap-2 px-4 py-1 active:scale-95"
          onClick={submit}
          disabled={submiting}
        >
          <Send className="size-4" />
          {t(submiting ? 'sending' : 'send')}
        </Button>
      </div>

      {showPublicWarning && (
        <Alert className="animate-show">
          <Globe2Icon className="h-4 w-4" />
          <AlertDescription className="text-primary font-light">
            {t('publicWarning')}
          </AlertDescription>
        </Alert>
      )}

      <ArticleSelectionModal
        open={articleSelectionOpen}
        onOpenChange={setArticleSelectionOpen}
        selectedArticle={rote.article as Article | null | undefined}
        onSelect={selectArticle}
        onCreateNew={() => {
          setArticleSelectionOpen(false);
          // 保存创建上下文，以便创建完成后自动返回并关联
          sessionStorage.setItem(
            ARTICLE_CREATION_CONTEXT_KEY,
            JSON.stringify({ returnPath: location.pathname })
          );
          navigate('/article/new?fromRoteEditor=true');
        }}
      />
    </div>
  );
}

export default RoteEditor;
