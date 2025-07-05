import { TagSelector } from '@/components/others/TagSelector';
import FileSelector from '@/components/others/uploader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';
import mainJson from '@/json/main.json';
import { emptyRote } from '@/state/editor';
import type { Attachment, Rote } from '@/types/main';
import { post, put } from '@/utils/api';
import { useAtom, type PrimitiveAtom } from 'jotai';
import { Archive, Globe2, Globe2Icon, PinIcon, Send, X } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const [rote, setRote] = useAtom(roteAtom);

  // 使用本地状态存储输入值，提高输入响应性
  const [localContent, setLocalContent] = useState(rote.content);
  const contentRef = useRef(rote.content);

  // 防抖更新 jotai 状态，减少不必要的重新渲染
  const debouncedUpdateContent = useDebounce(
    useCallback(
      (content: string) => {
        if (contentRef.current !== content) {
          contentRef.current = content;
          setRote((prevRote) => ({
            ...prevRote,
            content,
          }));
        }
      },
      [setRote]
    ),
    300 // 300ms 防抖延迟
  );

  // 优化的内容更新函数
  const handleContentChange = useCallback(
    (content: string) => {
      setLocalContent(content);
      debouncedUpdateContent(content);
    },
    [debouncedUpdateContent]
  );

  // 同步外部状态变化到本地状态
  if (rote.content !== contentRef.current && rote.content !== localContent) {
    setLocalContent(rote.content);
    contentRef.current = rote.content;
  }

  // 优化的删除文件函数
  const deleteFile = useCallback(
    (indexToRemove: number) => {
      if (rote.attachments[indexToRemove] instanceof File) {
        setRote((prevRote) => ({
          ...prevRote,
          attachments: prevRote.attachments.filter((_, index) => index !== indexToRemove),
        }));
      }
    },
    [rote.attachments, setRote]
  );

  // 优化的提交函数
  const submit = useCallback(() => {
    const contentToSubmit = localContent || rote.content;

    if (!contentToSubmit.trim() && rote.attachments.length === 0) {
      toast.error(t('error.emptyContent'));
      return;
    }

    const toastId = toast.loading(t('sending'));
    setSubmitting(true);

    const submitData = {
      ...rote,
      content: contentToSubmit.trim(),
      id: rote.id || undefined,
    };

    (rote.id ? put('/notes/' + rote.id, submitData) : post('/notes', submitData))
      .then(async (res) => {
        toast.success(t('sendSuccess'), {
          id: toastId,
        });
        await uploadAttachments(res.data);
      })
      .catch((error) => {
        const errorMessage = error.response?.data?.message || t('sendFailed');
        toast.error(`${t('sendFailed')}: ${errorMessage}`, {
          id: toastId,
        });
      })
      .finally(() => {
        setSubmitting(false);
        if (callback) {
          callback();
        }
        setRote(emptyRote);
        setLocalContent('');
        contentRef.current = '';
      });
  }, [localContent, rote, t, callback, setRote]);

  // 优化的文件上传函数
  const uploadAttachments = useCallback(
    (_rote: Rote) => {
      const filesToUpload = rote.attachments.filter(
        (file: Attachment | File) => file instanceof File && file.size > 0
      );

      if (filesToUpload.length === 0) {
        return Promise.resolve([]);
      }

      return new Promise((resolve, reject) => {
        const toastId = toast.loading(t('uploading'));

        try {
          const formData = new FormData();
          filesToUpload.forEach((file: Attachment | File) => {
            if (file instanceof File) {
              formData.append('images', file);
            }
          });

          post(`/attachments?noteId=${_rote.id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
            .then((res) => {
              if (res.code !== 0) return;
              toast.success(t('uploadSuccess'), {
                id: toastId,
              });
              resolve(res);
            })
            .catch((error) => {
              toast.error(`${t('uploadFailed')}: ${error.response?.data?.message ?? ''}`, {
                id: toastId,
              });
              reject(error);
            });
        } catch (error) {
          toast.error(`${t('uploadFailed')}: ${(error as any).response?.data?.message ?? ''}`, {
            id: toastId,
          });
          reject(error);
        }
      });
    },
    [rote.attachments, t]
  );

  // 优化的键盘事件处理
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        submit();
      }
    },
    [submit]
  );

  // 优化的粘贴事件处理
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob && blob.size > 0) {
            try {
              const file = new File([blob], `pasted-image-${Date.now()}.png`, {
                type: blob.type,
              });
              setRote((prevRote) => ({
                ...prevRote,
                attachments: [...prevRote.attachments, file],
              }));
            } catch {
              /* empty */
            }
          }
        }
      }
    },
    [setRote]
  );

  // 优化的拖拽事件处理
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      const files = e.dataTransfer.files;

      if (files.length > 0) {
        const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          setRote((prevRote) => ({
            ...prevRote,
            attachments: [...prevRote.attachments, ...imageFiles],
          }));
        }
      }
    },
    [setRote]
  );

  // 优化的拖拽悬停事件处理
  const handleDragOver = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
  }, []);

  // 优化的标签更新函数
  const updateTags = useCallback(
    (value: string[]) => {
      setRote((prevRote) => ({
        ...prevRote,
        tags: value.map((tag) => tag.trim()),
      }));
    },
    [setRote]
  );

  // 优化的标签删除函数
  const removeTag = useCallback(
    (tagToRemove: string) => {
      setRote((prevRote) => ({
        ...prevRote,
        tags: prevRote.tags.filter((tag) => tag !== tagToRemove),
      }));
    },
    [setRote]
  );

  // 优化的属性切换函数
  const toggleProperty = useCallback(
    (property: keyof Pick<Rote, 'pin' | 'archived'>) => {
      setRote((prevRote) => ({
        ...prevRote,
        [property]: !prevRote[property],
      }));
    },
    [setRote]
  );

  // 优化的状态切换函数
  const toggleState = useCallback(() => {
    setRote((prevRote) => ({
      ...prevRote,
      state: prevRote.state === 'public' ? 'private' : 'public',
    }));
  }, [setRote]);

  // 优化的文件添加回调
  const handleFileAdd = useCallback(
    (newFileList: File[]) => {
      setRote((prevRote) => ({
        ...prevRote,
        attachments: [...prevRote.attachments, ...newFileList],
      }));
    },
    [setRote]
  );

  // 计算是否显示公开警告
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
        <div className="flex flex-wrap gap-2">
          {rote.attachments.map((file, index: number) => (
            <div
              className="bg-background relative h-20 w-20 overflow-hidden rounded-lg"
              key={'attachments_' + index}
            >
              <img
                className="h-full w-full object-cover"
                height={80}
                width={80}
                src={
                  file instanceof File ? URL.createObjectURL(file) : file.compressUrl || file.url
                }
                alt="uploaded"
              />
              <div
                onClick={() => deleteFile(index)}
                className="absolute top-1 right-1 flex cursor-pointer items-center justify-center rounded-md bg-[#00000080] p-2 backdrop-blur-xl duration-300 hover:scale-95"
              >
                <X className="size-3 text-white" />
              </div>
            </div>
          ))}
          {rote.attachments.length < 9 && (
            <FileSelector
              id={rote.id || 'rote-editor-file-selector'}
              disabled={submiting}
              callback={handleFileAdd}
            />
          )}
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
