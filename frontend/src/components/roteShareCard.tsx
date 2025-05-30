import type { Attachment } from '@/types/main';
import { saveAs } from 'file-saver';
import { toPng } from 'html-to-image';
import { Link, Save, Zap } from 'lucide-react';
import moment from 'moment';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-qr-code';

function RoteShareCard({ rote }: any) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.roteShareCard',
  });
  const themes = [
    {
      cardClass: 'bg-white text-gray-800',
      tagClass: 'bg-[#00000010] text-gray-800',
      authorClass: 'text-gray-800',
      colorBlock: 'bg-white border-gray-800',
      qrcodeColor: '#2d3748',
    },
    {
      cardClass: 'bg-[#f5f5f5] text-[#255136]',
      tagClass: 'bg-[#00000010] text-[#255136]',
      authorClass: 'text-[#255136]',
      colorBlock: 'bg-[#f5f5f5] border-[#255136]',
      qrcodeColor: '#255136',
    },
    {
      cardClass: 'bg-zinc-800 text-white',
      tagClass: 'bg-[#ffffff10] text-white',
      authorClass: 'text-white',
      colorBlock: 'bg-zinc-800 border-white',
      qrcodeColor: '#ffffff',
    },
    {
      cardClass: 'bg-lime-300 text-gray-800',
      tagClass: 'bg-[#00000010] text-gray-800',
      authorClass: 'text-gray-800',
      colorBlock: 'bg-lime-300 border-gray-800',
      qrcodeColor: '#2d3748',
    },
  ];
  const decoration = [
    {
      neme: '流星',
      class: 'liuxing',
    },
  ];
  const [decorationIndex, setDecorationIndex] = useState<any>(null);
  const [themeIndex, setThemeIndex] = useState(1);

  async function saveImage(): Promise<void> {
    const toastId = toast.loading(t('generatingImage'));
    const element: any = document.querySelector('#shareCanva');
    if (element) {
      // 获取元素的宽度和高度
      const width = element.clientWidth;
      const height = element.clientHeight;

      // 配置 html2canvas 选项
      const options: any = {
        width: width,
        height: height,
        canvasWidth: (width * 720) / width,
        canvasHeight: (height * 720) / width,
        backgroundColor: null,
        cacheBust: true,
      };

      let dataUrl = await toPng(element, options);

      if (!dataUrl) {
        toast.error(t('imageGenerationFailed'), {
          id: toastId,
        });
        return;
      }

      if (window.saveAs) {
        window.saveAs(dataUrl, `${rote.id}.png`);
      } else {
        saveAs(dataUrl, `${rote.id}.png`);
      }

      toast.success(t('imageSaved'), {
        id: toastId,
      });
    } else {
      console.error(t('elementNotFound'));
    }
  }

  function copyLink() {
    let url = `${window.location.origin}/rote/${rote.id}`;
    navigator.clipboard.writeText(url);
    toast.success(t('linkCopied'));
  }

  function ColorList() {
    return (
      <div className="mr-auto flex gap-2">
        {themes.map((theme: any, index: any) => {
          return colorBlock(theme, index);
        })}
      </div>
    );
  }

  function colorBlock(theme: any, index: any) {
    return (
      <div
        className={`h-6 w-6 cursor-pointer rounded-full border border-r-8 ${
          index === themeIndex ? '' : 'opacity-20'
        } ${theme.colorBlock}`}
        key={`theme_${index}`}
        onClick={() => setThemeIndex(themes.indexOf(theme))}
      ></div>
    );
  }

  return (
    <div className="flex w-full cursor-default flex-col gap-5">
      <div
        className={`relative flex w-full flex-col gap-2 p-8 duration-300 ${
          themes[themeIndex].cardClass
        } ${decorationIndex !== null && decoration[decorationIndex].class}`}
        id="shareCanva"
      >
        <div className="font-sm opacity-60">
          {moment().utc(rote.createdAt).format('YYYY/MM/DD HH:mm:ss')}
        </div>
        <div className="font-serif leading-7 font-medium tracking-wide break-words whitespace-pre-line md:text-xl">
          {rote.content}
        </div>
        {rote.attachments.length > 0 && (
          <div className="my-2 flex w-full flex-wrap gap-1 overflow-hidden rounded-2xl">
            {rote.attachments.map((file: Attachment) => {
              return (
                <img
                  key={file.id}
                  className={` ${
                    rote.attachments.length % 3 === 0
                      ? 'aspect-square w-[calc(1/3*100%-2.6667px)]'
                      : rote.attachments.length % 2 === 0
                        ? 'aspect-square w-[calc(1/2*100%-2px)]'
                        : rote.attachments.length === 1
                          ? 'w-full max-w-[500px] rounded-2xl'
                          : 'aspect-square w-[calc(1/3*100%-2.6667px)]'
                  } bg-opacityLight dark:bg-opacityDark grow object-cover`}
                  src={
                    file.compressUrl
                      ? file.compressUrl + '?' + new Date().getTime()
                      : file.url + '?' + new Date().getTime()
                  }
                  alt=""
                  crossOrigin="anonymous"
                />
              );
            })}
          </div>
        )}
        <div className="md:text-md flex flex-wrap items-center gap-2 font-serif text-xs md:font-bold">
          {rote.tags.map((tag: any) => {
            return (
              <span
                className={`rounded-md px-2 py-1 md:px-3 ${themes[themeIndex].tagClass}`}
                key={tag}
              >
                {tag}
              </span>
            );
          })}
        </div>
        <div className="mt-2 flex w-full justify-between">
          <div className={`flex items-center gap-2 ${themes[themeIndex].authorClass}`}>
            <img
              className="w-10 rounded-md"
              src={rote.author.avatar + '?' + new Date().getTime()}
              alt=""
              crossOrigin="anonymous"
            />
            <div>
              <span className="font-serif text-sm font-semibold md:text-base">
                {rote.author.nickname}
              </span>
              <div className="hidden text-sm font-normal opacity-60 sm:block md:text-base">
                来自 {window.location.origin}/{rote.author.username}
              </div>
            </div>
          </div>
          <div className="h-10 w-10 shrink-0">
            <QRCode
              size={40}
              key={themeIndex}
              bgColor="transparent"
              fgColor={themes[themeIndex].qrcodeColor}
              style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
              value={`${window.location.origin}/${rote.author.username}`}
              viewBox={`0 0 256 256`}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <ColorList />
        <div
          className={`flex cursor-pointer items-center gap-2 rounded-md px-4 py-1 duration-300 select-none active:scale-95 ${
            decorationIndex !== null && 'bg-gray-100'
          }`}
          onClick={() => {
            if (decorationIndex === null) {
              setDecorationIndex(0);
            } else {
              setDecorationIndex(null);
            }
          }}
        >
          <Zap className="size-4" />
        </div>
        <div
          className="text-textLight dark:bg-bgLight dark:text-textLight flex cursor-pointer items-center gap-2 rounded-md px-4 py-1 duration-300 select-none active:scale-95"
          onClick={copyLink}
        >
          <Link className="size-4" />
          {t('copyLink')}
        </div>
        <div
          className="flex cursor-pointer items-center gap-2 rounded-md bg-black px-4 py-1 text-white duration-300 select-none active:scale-95"
          onClick={saveImage}
        >
          <Save className="size-4" />
          {t('save')}
        </div>
      </div>
    </div>
  );
}

export default RoteShareCard;
