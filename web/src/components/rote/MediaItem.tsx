import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { getAttachmentImagePreviewSrc, isHeicLikeAttachment } from '@/utils/directUpload';
import { AttachmentPhotoPreview } from './AttachmentPhotoPreview';
import { LivePhotoAttachmentPreview } from './LivePhotoAttachmentPreview';
import { VideoAttachmentPreview } from './VideoAttachmentPreview';
import { displayMediaRatio, type PostMediaItem } from './postMediaModel';
import {
  getSettledImageRatio,
  imageRatio,
  settleImageRatio,
} from '@/components/images/imageGeometry';

type MediaItemProps = {
  media: PostMediaItem;
  withTimeStamp?: boolean;
};

export function MediaItem({ media, withTimeStamp }: MediaItemProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'components.attachments' });
  const attachment = media.attachment;
  const previewSrc = getAttachmentImagePreviewSrc(attachment);
  const geometryKey = `rail:${attachment.id}:${media.thumbnail || attachment.url}`;
  const metadataRatio = imageRatio(attachment.details?.width, attachment.details?.height);
  const [measured, setMeasured] = useState<{ key: string; ratio: number }>();
  const aspectRatio =
    metadataRatio ??
    (measured?.key === geometryKey ? measured.ratio : getSettledImageRatio(geometryKey)) ??
    1;
  const recordDimensions = (width: number, height: number) => {
    const ratio = imageRatio(width, height);
    if (metadataRatio || !ratio) return;
    settleImageRatio(geometryKey, ratio);
    setMeasured((current) =>
      current?.key === geometryKey && current.ratio === ratio
        ? current
        : { key: geometryKey, ratio }
    );
  };
  // The row height stays fixed; only the item's width settles as dimensions arrive.
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
            recordDimensions(event.currentTarget.videoWidth, event.currentTarget.videoHeight);
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
          onDimensions={recordDimensions}
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
          onDimensions={recordDimensions}
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
