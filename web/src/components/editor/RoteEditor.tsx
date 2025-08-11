import { TagSelector } from '@/components/others/TagSelector';
import FileSelector from '@/components/others/uploader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import mainJson from '@/json/main.json';
import { emptyRote } from '@/state/editor';
import type { Attachment, Rote } from '@/types/main';
import { del, post, put } from '@/utils/api';
import { useAtom, type PrimitiveAtom } from 'jotai';
import debounce from 'lodash/debounce';
import { Archive, Globe2, Globe2Icon, PinIcon, Send, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import { toast } from 'sonner';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

const { roteMaxLetter } = mainJson;

type RoteAtomType = PrimitiveAtom<Rote>;

function RoteEditor({ roteAtom, callback }: { roteAtom: RoteAtomType; callback?: () => void }) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.roteInputSimple',
  });

  const [submiting, setSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Set<File>>(new Set());
  const [rote, setRote] = useAtom(roteAtom);

  const [localContent, setLocalContent] = useState(rote.content);

  useEffect(() => {
    if (rote.content !== localContent) {
      setLocalContent(rote.content);
    }
  }, [rote.content]);

  const debouncedUpdateContent = useMemo(
    () =>
      debounce((content: string) => {
        setRote((prevRote) => ({
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

  // 删除附件：先本地移除（乐观），再静默调用后端删除
  const deleteFile = useCallback(
    (indexToRemove: number) => {
      const item = rote.attachments[indexToRemove];
      // 先本地移除
      setRote((prevRote) => ({
        ...prevRote,
        attachments: prevRote.attachments.filter((_, index) => index !== indexToRemove),
      }));

      // 异步静默请求后端删除（仅对已上传的附件）
      if (!(item instanceof File)) {
        void del(`/attachments/${item.id}`).catch(() => {});
      }
    },
    [rote.attachments, setRote]
  );

  // 选择即上传：把 File 上传到 /attachments，若为编辑态且已有 rote.id 则直接绑定到该 note；否则仅创建“未绑定”的附件
  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files || files.length === 0) return;
      // 先把本地文件加入列表并标记上传中（乐观预览）
      setRote((prev) => ({ ...prev, attachments: [...prev.attachments, ...files] }));
      setUploadingFiles((prev) => {
        const next = new Set(prev);
        files.forEach((f) => next.add(f));
        return next;
      });
      try {
        const formData = new FormData();
        files.forEach((file) => formData.append('images', file));

        // 如果是编辑已存在的 note，携带 noteId 让后端直接绑定
        const url = rote.id ? `/attachments?noteId=${rote.id}` : '/attachments';
        const res = await post(url, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.code !== 0) {
          throw new Error(res.message || 'upload failed');
        }
        const newAttachments: Attachment[] = res.data;
        // 移除本地 File 占位，追加服务端返回的附件
        setRote((prev) => ({
          ...prev,
          attachments: [
            ...prev.attachments.filter((a) => !(a instanceof File && files.includes(a))),
            ...newAttachments,
          ],
        }));
      } catch (error: any) {
        // 失败：移除对应的本地 File 占位，并提示错误
        setRote((prev) => ({
          ...prev,
          attachments: prev.attachments.filter((a) => !(a instanceof File && files.includes(a))),
        }));
        toast.error(`${t('uploadFailed')}: ${error?.response?.data?.message ?? ''}`);
      } finally {
        // 无论成败，都清理上传中标记
        setUploadingFiles((prev) => {
          const next = new Set(prev);
          files.forEach((f) => next.delete(f));
          return next;
        });
      }
    },
    [rote.id, setRote, t]
  );

  const submit = useCallback(() => {
    const contentToSubmit = localContent;

    if (!contentToSubmit.trim() && rote.attachments.length === 0) {
      toast.error(t('error.emptyContent'));
      return;
    }

    const toastId = toast.loading(t('sending'));
    setSubmitting(true);

    // 对于新建场景，把未绑定的附件 id 带上，由后端绑定
    const attachmentIds = (
      rote.attachments.filter((a): a is Attachment => !(a instanceof File)) as Attachment[]
    )
      .filter((a) => !a.roteid)
      .map((a) => a.id);

    const submitData: any = {
      ...rote,
      content: contentToSubmit.trim(),
      id: rote.id || undefined,
      attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
    };

    (rote.id ? put('/notes/' + rote.id, submitData) : post('/notes', submitData))
      .then(async (_res) => {
        toast.success(t('sendSuccess'), {
          id: toastId,
        });
        if (callback) {
          callback();
        }
        setRote(emptyRote);
      })
      .catch((error) => {
        const errorMessage = error.response?.data?.message || t('sendFailed');
        toast.error(`${t('sendFailed')}: ${errorMessage}`, {
          id: toastId,
        });
      })
      .finally(() => {
        setSubmitting(false);
      });
  }, [localContent, rote, t, callback, setRote]);

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

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob && blob.size > 0) {
            const file = new File([blob], `pasted-image-${Date.now()}.png`, {
              type: blob.type,
            });
            uploadFiles([file]);
          }
        }
      }
    },
    [uploadFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      const files = e.dataTransfer.files;

      if (files.length > 0) {
        const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          uploadFiles(imageFiles);
        }
      }
    },
    [uploadFiles]
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
      uploadFiles(newFileList);
    },
    [uploadFiles]
  );

  const showPublicWarning = useMemo(() => rote.state === 'public', [rote.state]);

  return (
    <div className="bg-background grow space-y-2">
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

      {process.env.REACT_APP_ALLOW_UPLOAD_FILE === 'true' && (
        <PhotoProvider>
          <div className="flex flex-wrap gap-2">
            {rote.attachments.map((file, index: number) => {
              const isUploading = file instanceof File && uploadingFiles.has(file);
              const thumbSrc =
                file instanceof File ? URL.createObjectURL(file) : file.compressUrl || file.url;
              const previewSrc = file instanceof File ? thumbSrc : file.url;
              return (
                <div
                  className="bg-background relative h-20 w-20 overflow-hidden rounded-lg"
                  key={'attachments_' + index}
                >
                  <PhotoView src={previewSrc}>
                    <img
                      className={`h-full w-full object-cover ${isUploading ? 'opacity-80' : ''}`}
                      height={80}
                      width={80}
                      src={thumbSrc}
                      alt="uploaded"
                    />
                  </PhotoView>
                  {/* 上传中遮罩与小型 spinner */}
                  {isUploading && (
                    <div className="absolute inset-0 grid place-items-center bg-black/30">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                    </div>
                  )}
                  <div
                    onClick={() => deleteFile(index)}
                    className="absolute top-1 right-1 flex cursor-pointer items-center justify-center rounded-md bg-[#00000080] p-2 backdrop-blur-xl duration-300 hover:scale-95"
                  >
                    <X className="size-3 text-white" />
                  </div>
                </div>
              );
            })}
            {rote.attachments.length < 9 && (
              <FileSelector
                id={rote.id || 'rote-editor-file-selector'}
                disabled={submiting}
                callback={handleFileAdd}
              />
            )}
          </div>
        </PhotoProvider>
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

      <div className="noScrollBar flex flex-wrap items-center gap-2 overflow-x-scroll">
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
          {t('send')}
        </Button>
      </div>

      {showPublicWarning && (
        <Alert className="animate-show">
          <Globe2Icon className="h-4 w-4" />
          <AlertDescription>你的内容将会被公开，任何人都可以查看。</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default RoteEditor;
