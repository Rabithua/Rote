import { apiAddRote, apiEditMyRote, apiUploadFiles } from '@/api/rote/main';
import mainJson from '@/json/main.json';
import { emptyRote } from '@/state/editor';
import type { Attachment, Rote } from '@/types/main';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useAtom, type PrimitiveAtom } from 'jotai';
import { Archive, Globe2, Globe2Icon, PinIcon, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { TagSelector } from '@/components/ui/others/TagSelector';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState } from 'react';
import FileSelector from '@/components/uploader';

const { roteMaxLetter } = mainJson;

type RoteAtomType = PrimitiveAtom<Rote>;

function RoteEditor({
  roteAtom,
  callback,
}: {
  roteAtom: RoteAtomType;
  callback?: (rote: Rote) => void;
}) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.roteInputSimple',
  });

  const [submiting, setSubmitting] = useState(false);

  const [rote, setRote] = useAtom(roteAtom);

  function deleteFile(indexToRemove: number) {
    if (rote.attachments[indexToRemove] instanceof File) {
      setRote((prevRote) => ({
        ...prevRote,
        attachments: prevRote.attachments.filter((_, index) => index !== indexToRemove),
      }));
    }
  }

  function submit() {
    if (!rote.content.trim() && rote.attachments.length === 0) {
      toast.error(t('error.emptyContent'));
      return;
    }

    const toastId = toast.loading(t('sending'));

    setSubmitting(true);

    (rote.id
      ? apiEditMyRote(rote)
      : apiAddRote({
          ...rote,
          content: rote.content.trim(),
        })
    )
      .then(async (res) => {
        toast.success(t('sendSuccess'), {
          id: toastId,
        });
        await uploadAttachments(res.data.data);
      })
      .catch(() => {
        toast.error(t('sendFailed'), {
          id: toastId,
        });
      })
      .finally(() => {
        setSubmitting(false);
        callback && callback(rote);
        setRote(emptyRote);
      });
  }

  function uploadAttachments(_rote: Rote) {
    if (
      rote.attachments.filter((file: Attachment | File) => file instanceof File && file.size > 0)
        .length === 0
    ) {
      return [];
    }

    return new Promise((reslove, reject) => {
      const toastId = toast.loading(t('uploading'));

      try {
        const formData = new FormData();
        rote.attachments.forEach((file: Attachment | File) => {
          if (file instanceof File) {
            formData.append('images', file);
          }
        });
        apiUploadFiles(formData, _rote.id).then((res) => {
          if (res.data.code !== 0) return;
          toast.success(t('uploadSuccess'), {
            id: toastId,
          });
          reslove(res);
        });
      } catch (error) {
        toast.error(t('uploadFailed'), {
          id: toastId,
        });
        console.error('Error uploading image:', error);
        reject();
      }
    });
  }

  function handleNormalINputKeyDown(e: any) {
    if (e.key === 'Enter' && e.ctrlKey) {
      submit();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
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
          } catch (error) {
            console.log('Error creating object URL:', error);
          }
        }
      }
    }
  }

  function handleDrop<T extends HTMLElement>(e: React.DragEvent<T>) {
    e.preventDefault();
    const files = e.dataTransfer.files;

    if (files.length > 0) {
      Array.from(files).forEach((file) => {
        if (file.type.startsWith('image/')) {
          setRote((prevRote) => ({
            ...prevRote,
            attachments: [...prevRote.attachments, file],
          }));
        } else {
          console.warn(`File ${file.name} is not an image and was skipped.`);
        }
      });
    }
  }

  return (
    <div className="bg-bgLight dark:bg-bgDark grow space-y-2">
      <Textarea
        value={rote.content}
        placeholder={t('contentPlaceholder')}
        className={`textareaInit lg:text-lg`}
        maxLength={roteMaxLetter}
        disabled={submiting}
        onInput={(e: any) => {
          setRote({
            ...rote,
            content: e.currentTarget.value,
          } as Rote);
        }}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e: any) => e.preventDefault()}
        onKeyDown={handleNormalINputKeyDown}
        rows={3}
      />

      {process.env.REACT_APP_ALLOW_UPLOAD_FILE === 'true' && (
        <div className="flex flex-wrap gap-2">
          {rote.attachments.map((file, index: number) => {
            return (
              <div
                className="bg-bgLight relative h-20 w-20 overflow-hidden rounded-lg"
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
                  className="absolute top-1 right-1 flex cursor-pointer items-center justify-center rounded-md bg-[#00000080] p-2 backdrop-blur-3xl duration-300 hover:scale-95"
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
              callback={(newFileList: File[]) => {
                console.log('FileSelector callback', newFileList);

                setRote((prevRote) => ({
                  ...prevRote,
                  attachments: [...prevRote.attachments, ...newFileList],
                }));
              }}
            />
          )}
        </div>
      )}

      <div className={`animate-show flex shrink-0 flex-wrap gap-2 opacity-0 duration-300`}>
        {rote.tags.map((item: string) => {
          return (
            <div
              className="bg-opacityLight dark:bg-opacityDark flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-center text-xs duration-300 hover:scale-95"
              onClick={() => {
                const newTags = rote.tags.filter((tag) => tag !== item);
                setRote({
                  ...rote,
                  tags: newTags,
                });
              }}
              key={item}
            >
              {item}
              <X className="size-3 text-[#00000080] duration-300 hover:scale-95" />
            </div>
          );
        })}
      </div>

      <div className="noScrollBar flex flex-wrap items-center gap-2 overflow-x-scroll">
        <TagSelector
          tags={rote.tags}
          setTags={(value: string[]) => {
            setRote({
              ...rote,
              tags: value.map((tag) => {
                return tag.trim();
              }),
            });
          }}
          callback={(value: string[]) => {
            console.log('TagSelector', value);
          }}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <PinIcon
              className={`size-8 cursor-pointer rounded-md p-2 duration-300 ${
                rote.pin ? 'bg-opacityLight dark:bg-opacityDark' : ''
              }`}
              onClick={() => {
                setRote({
                  ...rote,
                  pin: !rote.pin,
                });
              }}
            />
          </TooltipTrigger>
          <TooltipContent sideOffset={4}>{t('pin')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Archive
              className={`size-8 cursor-pointer rounded-md p-2 duration-300 ${
                rote.archived ? 'bg-opacityLight dark:bg-opacityDark' : ''
              }`}
              onClick={() => {
                setRote({
                  ...rote,
                  archived: !rote.archived,
                });
              }}
            />
          </TooltipTrigger>
          <TooltipContent sideOffset={4}>{t('archive')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Globe2
              className={`size-8 cursor-pointer rounded-md p-2 duration-300 ${
                rote.state === 'public' ? 'bg-opacityLight dark:bg-opacityDark' : ''
              }`}
              onClick={() => {
                setRote({
                  ...rote,
                  state: rote.state === 'public' ? 'private' : 'public',
                });
              }}
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

      {rote.state === 'public' && (
        <Alert className="animate-show">
          <Globe2Icon className="h-4 w-4" />
          <AlertDescription>你的内容将会被公开，任何人都可以查看。</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default RoteEditor;
