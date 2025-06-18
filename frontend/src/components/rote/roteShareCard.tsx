import { SoftBottom } from '@/components/others/SoftBottom';
import { Button } from '@/components/ui/button';
import { saveAs } from 'file-saver';
import { toPng } from 'html-to-image';
import { Link, Save } from 'lucide-react';
import moment from 'moment';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-qr-code';
import { toast } from 'sonner';
import AttachmentsGrid from './AttachmentsGrid';

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
  const [themeIndex, setThemeIndex] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  async function saveImage(): Promise<void> {
    setIsGenerating(true);
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

      const dataUrl = await toPng(element, options);

      if (!dataUrl) {
        toast.error(t('imageGenerationFailed'));
        setIsGenerating(false);
        return;
      }

      if (window.saveAs) {
        window.saveAs(dataUrl, `${rote.id}.png`);
      } else {
        saveAs(dataUrl, `${rote.id}.png`);
      }

      toast.success(t('imageSaved'));
      setIsGenerating(false);
    } else {
      setIsGenerating(false);
    }
  }

  function copyLink() {
    const url = `${window.location.origin}/rote/${rote.id}`;
    navigator.clipboard.writeText(url);
    toast.success(t('linkCopied'));
  }

  function ColorList() {
    return (
      <div className="mr-auto flex gap-2">
        {themes.map((theme: any, index: any) => colorBlock(theme, index))}
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
    <div className="relative flex max-h-[60dvh] w-full cursor-default flex-col gap-5 overflow-scroll">
      <div
        className={`relative flex w-full flex-col gap-2 p-8 duration-300 ${
          themes[themeIndex].cardClass
        } `}
        id="shareCanva"
      >
        <div className="font-sm opacity-60">
          {moment().utc(rote.createdAt).format('YYYY/MM/DD HH:mm:ss')}
        </div>
        <div className="font-serif leading-7 font-light tracking-wide break-words whitespace-pre-line md:text-lg">
          {rote.content}
        </div>
        <AttachmentsGrid attachments={rote.attachments} />
        <div className="md:text-md flex flex-wrap items-center gap-2 font-serif text-xs">
          {rote.tags.map((tag: any) => (
            <span
              className={`rounded-md px-2 py-1 md:px-3 ${themes[themeIndex].tagClass}`}
              key={tag}
            >
              {tag}
            </span>
          ))}
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

        <Button variant="secondary" onClick={copyLink}>
          <Link className="size-4" />
          {t('copyLink')}
        </Button>
        <Button disabled={isGenerating} onClick={saveImage} className="gap-2">
          <Save className="size-4" />
          {isGenerating ? t('generatingImage') : t('save')}
        </Button>
      </div>

      <SoftBottom className="translate-y-1" spacer />
    </div>
  );
}

export default RoteShareCard;
