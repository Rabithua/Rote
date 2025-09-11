import type { Attachment } from '@/types/main';
import { X } from 'lucide-react';
import { PhotoView } from 'react-photo-view';

interface AttachmentItemProps {
  attachment: File | Attachment;
  index: number;
  isUploading: boolean;
  onDelete: (_index: number) => void;
}

function AttachmentItem({ attachment, index, isUploading, onDelete }: AttachmentItemProps) {
  const thumbSrc =
    attachment instanceof File
      ? URL.createObjectURL(attachment)
      : attachment.compressUrl || attachment.url;
  const previewSrc = attachment instanceof File ? thumbSrc : attachment.url;

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
        onClick={() => onDelete(index)}
        className="absolute top-1 right-1 flex cursor-pointer items-center justify-center rounded-md bg-[#00000080] p-2 backdrop-blur-xl duration-300 hover:scale-95"
      >
        <X className="size-3 text-white" />
      </div>
    </div>
  );
}

export default AttachmentItem;
