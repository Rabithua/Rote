import type { CSSProperties, SyntheticEvent } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAttachmentImagePreviewSrc, isHeicLikeAttachment } from '@/utils/directUpload';
import { AttachmentPhotoPreview } from './AttachmentPhotoPreview';
import { LivePhotoAttachmentPreview } from './LivePhotoAttachmentPreview';
import { VideoAttachmentPreview } from './VideoAttachmentPreview';
import { displayMediaRatio, type PostMediaItem } from './postMediaModel';

type MediaItemProps = {
  media: PostMediaItem;
  withTimeStamp?: boolean;
};

export function MediaItem({ media, withTimeStamp }: MediaItemProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'components.attachments' });
  const [aspectRatio, setAspectRatio] = useState(media.aspectRatio);
  const attachment = media.attachment;
  const previewSrc = getAttachmentImagePreviewSrc(attachment);
  const measureImage = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      setAspectRatio(image.naturalWidth / image.naturalHeight);
    }
  };
  const style = { '--display-ratio': displayMediaRatio(aspectRatio) } as CSSProperties;

  return (
    <div className="post-media-item" style={style} data-media-type={media.type}>
      {media.type === 'video' ? (
        <VideoAttachmentPreview
          className="h-full w-full"
          mediaClassName="h-full w-full object-cover"
          playbackSrc={attachment.url}
          posterSrc={media.thumbnail}
          railOverlay
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              setAspectRatio(video.videoWidth / video.videoHeight);
            }
          }}
        />
      ) : media.isLivePhoto ? (
        <LivePhotoAttachmentPreview
          attachment={attachment}
          className="h-full w-full"
          imageClassName="h-full w-full object-cover"
          previewSrc={previewSrc}
          thumbnailSrc={media.thumbnail || ''}
          crossOrigin={withTimeStamp ? 'anonymous' : undefined}
          onStillLoad={measureImage}
        />
      ) : (
        <AttachmentPhotoPreview
          alt=""
          containerClassName="h-full w-full overflow-hidden"
          crossOrigin={withTimeStamp ? 'anonymous' : undefined}
          imageClassName="h-full w-full object-cover"
          heicOriginalSrc={isHeicLikeAttachment(attachment) ? attachment.url : undefined}
          previewSrc={previewSrc}
          src={media.thumbnail || ''}
          onImageLoad={measureImage}
          unavailableLabel={
            (attachment.details as Record<string, unknown> | undefined)
              ?.previewRequiresAuthorization
              ? t('sourcePreviewUnavailable')
              : undefined
          }
        />
      )}
    </div>
  );
}
