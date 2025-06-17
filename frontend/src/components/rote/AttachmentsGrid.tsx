import type { Attachment } from '@/types/main';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';

interface AttachmentsGridProps {
  attachments: (Attachment | File)[];
  className?: string;
}

/**
 * AttachmentsGrid 组件 - 用于显示附件网格
 * 支持1-9张图片的自适应布局
 */
export default function AttachmentsGrid({ attachments, className = '' }: AttachmentsGridProps) {
  if (attachments.length === 0) {
    return null;
  }

  /**
   * 根据附件数量计算图片的样式类名
   * @param totalCount 附件总数
   * @param index 当前附件索引
   * @returns 样式类名
   */
  const getImageClassName = (totalCount: number, index: number): string => {
    const baseClasses = 'bg-foreground/3 grow object-cover';

    if (totalCount === 1) {
      return `w-full max-w-[500px] rounded-2xl border-[0.5px] ${baseClasses}`;
    }

    if (totalCount === 2) {
      return `aspect-square w-[calc(1/2*100%-4px)] ${baseClasses}`;
    }

    if (totalCount === 3) {
      // 3张图：第一张占一行，后两张占第二行
      if (index === 0) {
        return `w-full aspect-[2/1] ${baseClasses}`;
      }
      return `aspect-square w-[calc(1/2*100%-2px)] ${baseClasses}`;
    }

    if (totalCount === 4) {
      return `aspect-square w-[calc(1/2*100%-2px)] ${baseClasses}`;
    }

    if (totalCount === 5) {
      // 5张图：前两张占第一行，后三张占第二行
      if (index < 2) {
        return `aspect-square w-[calc(1/2*100%-2px)] ${baseClasses}`;
      }
      return `aspect-square w-[calc(1/3*100%-3px)] ${baseClasses}`;
    }

    if (totalCount === 6) {
      return `aspect-square w-[calc(1/3*100%-3px)] ${baseClasses}`;
    }

    if (totalCount === 7) {
      // 7张图：第一张占第一行，后六张分两行
      if (index === 0) {
        return `w-full aspect-[3/1] ${baseClasses}`;
      }
      return `aspect-square w-[calc(1/3*100%-3px)] ${baseClasses}`;
    }

    if (totalCount === 8) {
      // 8张图：前两张占第一行，后六张分两行
      if (index < 2) {
        return `aspect-square w-[calc(1/2*100%-2px)] ${baseClasses}`;
      }
      return `aspect-square w-[calc(1/3*100%-3px)] ${baseClasses}`;
    }

    // 9张图或更多：统一3x3网格
    return `aspect-square w-[calc(1/3*100%-3px)] ${baseClasses}`;
  };

  /**
   * 获取图片源地址
   * @param file 附件对象
   * @returns 图片地址
   */
  const getImageSrc = (file: Attachment | File): string => {
    if (file instanceof File) {
      return URL.createObjectURL(file);
    }
    return file.compressUrl || file.url;
  };

  /**
   * 获取高清图片地址（用于PhotoView查看）
   * @param file 附件对象
   * @returns 高清图片地址
   */
  const getHighResSrc = (file: Attachment | File): string => {
    if (file instanceof File) {
      return URL.createObjectURL(file);
    }
    return file.url;
  };

  return (
    <div className={`my-2 flex w-fit flex-wrap gap-1 overflow-hidden rounded-2xl ${className}`}>
      <PhotoProvider>
        {attachments.map((file, index) => (
          <PhotoView key={`attachment_${index}`} src={getHighResSrc(file)}>
            <img
              className={getImageClassName(attachments.length, index)}
              src={getImageSrc(file)}
              loading="lazy"
              alt=""
            />
          </PhotoView>
        ))}
      </PhotoProvider>
    </div>
  );
}
