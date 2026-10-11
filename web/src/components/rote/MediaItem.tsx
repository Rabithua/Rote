import type { CSSProperties } from 'react';
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
  const attachment = media.attachment;
  const previewSrc = getAttachmentImagePreviewSrc(attachment);
  // The rail's metadata owns its geometry; late thumbnails must not shift its scroll position.
  const style = { '--display-ratio': displayMediaRatio(media.aspectRatio) } as CSSProperties;

  return (
    <div className="post-media-item" style={style} data-media-type={media.type}>
      {media.type === 'video' ? (
        <VideoAttachmentPreview
          className="h-full w-full"
          mediaClassName="h-full w-full object-cover"
          playbackSrc={attachment.url}
          posterSrc={media.thumbnail}
          railOverlay
        />
      ) : media.isLivePhoto ? (
        <LivePhotoAttachmentPreview
          attachment={attachment}
          className="h-full w-full"
          imageClassName="h-full w-full object-cover"
          previewSrc={previewSrc}
          thumbnailSrc={media.thumbnail || ''}
          crossOrigin={withTimeStamp ? 'anonymous' : undefined}
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
