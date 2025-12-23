import { TagSelector } from '@/components/others/TagSelector';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import mainJson from '@/json/main.json';

import type { Attachment, Rote } from '@/types/main';
import { del, post, put } from '@/utils/api';
import { finalize as finalizeUpload, presign, uploadToSignedUrl } from '@/utils/directUpload';
// 压缩与并发工具
import { useSiteStatus } from '@/hooks/useSiteStatus';
import { maybeCompressToWebp, qualityForSize, runConcurrency } from '@/utils/uploadHelpers';
import { useAtom, type PrimitiveAtom } from 'jotai';
import debounce from 'lodash/debounce';
import { Archive, Globe2, Globe2Icon, PinIcon, Send, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import 'react-photo-view/dist/react-photo-view.css';
import { toast } from 'sonner';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import AttachmentList from './AttachmentList';

const { roteMaxLetter } = mainJson;

type RoteAtomType = PrimitiveAtom<Rote>;

function RoteEditor({ roteAtom, callback }: { roteAtom: RoteAtomType; callback?: () => void }) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.roteInputSimple',
  });

  const [submiting, setSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Set<File>>(new Set());
  const [rote, setRote] = useAtom(roteAtom);
  const { data: siteStatus } = useSiteStatus();
  const canUpload =
    !!siteStatus?.storage?.r2Configured && siteStatus?.ui?.allowUploadFile !== false;

  const [localContent, setLocalContent] = useState(rote.content);

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
      id: '',
      author: {
        username: '',
        nickname: '',
        avatar: '',
      },
      createdAt: '',
      updatedAt: '',
    };

    setRote(emptyRote);
    setLocalContent('');
    setUploadingFiles(new Set());
  }, [setRote]);

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

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files?.length) return;
      setRote((prev) => ({ ...prev, attachments: [...prev.attachments, ...files] }));
      setUploadingFiles((prev) => {
        const next = new Set(prev);
        files.forEach((f) => next.add(f));
        return next;
      });

      try {
        const signItems = await presign(
          files.map((f) => ({
            filename: f.name,
            contentType: f.type || 'application/octet-stream',
            size: f.size,
          }))
        );

        const pairs = signItems.map((item, idx) => ({ item, file: files[idx] }));

        const CONCURRENCY = 3;
        const toFinalize: Array<{
          uuid: string;
          originalKey: string;
          compressedKey?: string;
          size: number;
          mimetype: string;
        }> = [];

        // 使用改进后的 runConcurrency，获取每个任务的成功/失败状态
        const results = await runConcurrency(
          pairs,
          async ({ item, file }, _index) => {
            // 防御：空文件不上传
            if (!file || (file as File).size === 0) {
              throw new Error('Empty file');
            }

            // 先压缩图片（如果支持）
            const compressedBlob = await maybeCompressToWebp(file, {
              maxWidthOrHeight: 2560,
              initialQuality: qualityForSize(file.size),
            });

            // 原图上传（必须成功）
            await uploadToSignedUrl(item.original.putUrl, file);

            // 压缩图上传（可选，失败不影响原图）
            let compressedKey: string | undefined;
            if (compressedBlob) {
              try {
                await uploadToSignedUrl(item.compressed.putUrl, compressedBlob);
                // 只有上传成功才记录 compressedKey
                compressedKey = item.compressed.key;
              } catch (error) {
                // 压缩图上传失败，但不影响原图，只记录错误
                // eslint-disable-next-line no-console
                console.warn(`Compressed image upload failed for ${item.uuid}:`, error);
                // 不设置 compressedKey，表示压缩图未成功上传
              }
            }

            // 只有原图上传成功（且压缩图上传成功或不需要压缩）才添加到 toFinalize
            // 注意：这里不直接 push，而是通过返回值处理
            return {
              uuid: item.uuid,
              originalKey: item.original.key,
              compressedKey,
              size: file.size,
              mimetype: file.type,
            };
          },
          CONCURRENCY
        );

        // 只处理成功上传的文件
        for (const result of results) {
          if (result.success && result.result) {
            // result.result 是 worker 函数返回的数据
            toFinalize.push(result.result);
          } else {
            // 记录失败的文件
            // eslint-disable-next-line no-console
            console.error(
              `File upload failed for index ${result.index}:`,
              result.error?.message || 'Unknown error'
            );
          }
        }

        // 如果没有成功上传的文件，抛出错误
        if (toFinalize.length === 0) {
          const failedCount = results.filter((r) => !r.success).length;
          throw new Error(
            `All ${failedCount} file(s) failed to upload. Please check your network connection and try again.`
          );
        }

        // 如果有部分文件失败，提示用户
        const failedCount = results.filter((r) => !r.success).length;
        if (failedCount > 0) {
          toast.warning(
            `${failedCount} file(s) failed to upload, ${toFinalize.length} file(s) uploaded successfully.`
          );
        }

        const finalizeData = toFinalize;
        // 批量 finalize，减少请求数
        const finalized = finalizeData.length
          ? await finalizeUpload(finalizeData, rote.id || undefined)
          : [];

        // 用后端返回结果替换本地 File 占位
        setRote((prev) => ({
          ...prev,
          attachments: [
            ...prev.attachments.filter((a) => !(a instanceof File && files.includes(a))),
            ...(Array.isArray(finalized) ? finalized : []),
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
        // 清理上传中标记
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

    // 对于编辑场景，收集已绑定附件的排序信息
    const existingAttachmentIds = (
      rote.attachments.filter((a): a is Attachment => !(a instanceof File)) as Attachment[]
    )
      .filter((a) => a.roteid === rote.id)
      .map((a) => a.id);

    const submitData: any = {
      ...rote,
      content: contentToSubmit.trim(),
      id: rote.id || undefined,
      attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
    };

    const submitPromise = rote.id
      ? put('/notes/' + rote.id, submitData).then(async (res) => {
          // 更新笔记后，如果有附件排序变化，发送排序更新请求
          if (existingAttachmentIds.length > 0) {
            await put('/attachments/sort', {
              roteId: rote.id,
              attachmentIds: existingAttachmentIds,
            });
          }
          return res;
        })
      : post('/notes', submitData);

    submitPromise
      .then(async (res) => {
        toast.success(t('sendSuccess'), {
          id: toastId,
        });

        // 执行回调
        if (callback) {
          callback();
        }

        // 清理编辑器状态
        if (callback) {
          // 有回调说明是在弹窗或组件中，需要重置编辑器
          resetEditor();
        } else if (!rote.id) {
          // 新建笔记成功，重置编辑器为空状态
          resetEditor();
        } else if (res?.data) {
          // 编辑现有笔记，更新为服务器返回的数据
          setRote(res.data);
          setLocalContent(res.data.content || '');
        }
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

  // 处理附件重新排序
  const handleAttachmentReorder = useCallback(
    (reorderedAttachments: (File | Attachment)[]) => {
      setRote((prevRote) => ({
        ...prevRote,
        attachments: reorderedAttachments,
      }));
    },
    [setRote]
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

      {canUpload && (
        <AttachmentList
          attachments={rote.attachments}
          uploadingFiles={uploadingFiles}
          onDelete={deleteFile}
          onReorder={handleAttachmentReorder}
          onFileAdd={handleFileAdd}
          roteId={rote.id}
          disabled={submiting}
        />
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
          <AlertDescription>{t('publicWarning')}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default RoteEditor;
