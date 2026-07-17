import type { Attachment } from '@/types/main';
import { AttachmentPhotoPreview } from '@/components/rote/AttachmentPhotoPreview';
import { LivePhotoAttachmentPreview } from '@/components/rote/LivePhotoAttachmentPreview';
import { VideoAttachmentPreview } from '@/components/rote/VideoAttachmentPreview';
import {
  getAttachmentImagePreviewSrc,
  getAttachmentImageThumbnailSrc,
  getAttachmentMediaKind,
} from '@/utils/directUpload';
import { generateVideoPoster } from '@/utils/generateVideoPoster';
import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface AttachmentItemProps {
  attachment: File | Attachment;
  index: number;
  isUploading: boolean;
  uploadProgress?: number;
  onDelete: (_index: number) => void;
}

function AttachmentItem({
  attachment,
  index,
  isUploading,
  uploadProgress,
  onDelete,
}: AttachmentItemProps) {
  const mediaKind = getAttachmentMediaKind(attachment);
  const isLivePhoto = mediaKind === 'livePhoto';
  const [localPosterSrc, setLocalPosterSrc] = useState<string | null>(null);
  const objectUrl = useMemo(
    () => (attachment instanceof File ? URL.createObjectURL(attachment) : null),
    [attachment]
  );

  useEffect(() => (objectUrl ? () => URL.revokeObjectURL(objectUrl) : undefined), [objectUrl]);

  useEffect(() => {
    if (!(attachment instanceof File) || mediaKind !== 'video') {
      setLocalPosterSrc(null);
      return;
    }

    let active = true;
    let posterObjectUrl: string | null = null;

    void generateVideoPoster(attachment).then((posterBlob) => {
      if (!active || !posterBlob) return;
      posterObjectUrl = URL.createObjectURL(posterBlob);
      setLocalPosterSrc(posterObjectUrl);
    });

    return () => {
      active = false;
      if (posterObjectUrl) {
        URL.revokeObjectURL(posterObjectUrl);
      }
    };
  }, [attachment, mediaKind]);

  const thumbSrc =
    mediaKind === 'video'
      ? localPosterSrc || (!(attachment instanceof File) ? attachment.posterUrl || '' : '')
      : objectUrl ||
        (!(attachment instanceof File) ? getAttachmentImageThumbnailSrc(attachment) : '');
  const previewSrc =
    objectUrl ||
    (!(attachment instanceof File)
      ? mediaKind === 'video'
        ? attachment.url
        : getAttachmentImagePreviewSrc(attachment)
      : '');
  const progressValue =
    typeof uploadProgress === 'number' ? Math.max(0, Math.min(100, uploadProgress)) : 0;

  return (
    <div
      className={`bg-background relative overflow-hidden ${
        mediaKind === 'video'
          ? 'aspect-video w-full rounded-2xl border border-white/10 bg-black'
          : 'h-20 w-20 rounded-lg'
      }`}
      key={'attachments_' + index}
    >
      {mediaKind === 'video' ? (
        <>
          <VideoAttachmentPreview
            className="h-full w-full"
            disabled={isUploading}
            mediaClassName={isUploading ? 'opacity-55' : undefined}
            playbackSrc={previewSrc}
            posterSrc={thumbSrc}
            stopInteractionPropagation
          />

          {isUploading && (
            <>
              <div className="pointer-events-none absolute inset-0 bg-black/20" />
              <div className="pointer-events-none absolute inset-0 animate-pulse bg-white/10" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-sm font-medium text-white sm:text-base">{progressValue}%</div>
              </div>
              <div className="pointer-events-none absolute right-0 bottom-0 left-0 px-3 py-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white transition-[width] duration-150"
                    style={{ width: `${progressValue}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </>
      ) : isLivePhoto && !(attachment instanceof File) ? (
        <LivePhotoAttachmentPreview
          attachment={attachment}
          className="relative h-full w-full"
          imageClassName={`h-full w-full object-cover ${isUploading ? 'opacity-80' : ''}`}
          badgeClassName="bottom-1.5 left-1.5"
          previewSrc={previewSrc}
          thumbnailSrc={thumbSrc}
        />
      ) : (
        <AttachmentPhotoPreview
          alt="uploaded"
          containerClassName="relative h-full w-full"
          height={80}
          imageClassName={`h-full w-full object-cover ${isUploading ? 'opacity-80' : ''}`}
          previewSrc={previewSrc}
          src={thumbSrc}
          width={80}
        />
      )}

      {isUploading && mediaKind !== 'video' && (
        <div className="absolute inset-0 grid place-items-center bg-black/30">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
        </div>
      )}

      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(index);
        }}
        className="absolute top-1.5 right-1.5 z-10 flex cursor-pointer items-center justify-center rounded-md bg-[#00000080] p-2 backdrop-blur-xl duration-300 hover:scale-95"
        aria-label="Delete attachment"
      >
        <X className="size-3 text-white" />
      </button>
    </div>
  );
}

export default AttachmentItem;
