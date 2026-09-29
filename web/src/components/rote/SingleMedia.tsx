import { useTranslation } from 'react-i18next';
import { getAttachmentImagePreviewSrc, isHeicLikeAttachment } from '@/utils/directUpload';
import { AttachmentPhotoPreview } from './AttachmentPhotoPreview';
import { LivePhotoAttachmentPreview } from './LivePhotoAttachmentPreview';
import { VideoAttachmentPreview } from './VideoAttachmentPreview';
import type { PostMediaItem } from './postMediaModel';

type SingleMediaProps = {
  media: PostMediaItem;
  withTimeStamp?: boolean;
};

export function SingleMedia({ media, withTimeStamp }: SingleMediaProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'components.attachments' });
  const attachment = media.attachment;
  const previewSrc = getAttachmentImagePreviewSrc(attachment);

  if (media.type === 'video') {
    return (
      <VideoAttachmentPreview
        className="bg-foreground/3 w-full rounded-2xl border-[0.5px]"
        mediaClassName="h-full w-full object-contain"
        playbackSrc={attachment.url}
        posterSrc={media.thumbnail}
      />
    );
  }

  if (media.isLivePhoto) {
    return (
      <LivePhotoAttachmentPreview
        attachment={attachment}
        className="w-full rounded-2xl border-[0.5px]"
        imageClassName="bg-foreground/3 block w-full object-cover"
        previewSrc={previewSrc}
        thumbnailSrc={media.thumbnail || ''}
        crossOrigin={withTimeStamp ? 'anonymous' : undefined}
      />
    );
  }

  return (
    <AttachmentPhotoPreview
      alt=""
      containerClassName="relative w-full overflow-hidden rounded-2xl border-[0.5px]"
      crossOrigin={withTimeStamp ? 'anonymous' : undefined}
      imageClassName="bg-foreground/3 block w-full object-cover"
      heicOriginalSrc={isHeicLikeAttachment(attachment) ? attachment.url : undefined}
      previewSrc={previewSrc}
      src={media.thumbnail || ''}
      unavailableLabel={
        (attachment.details as Record<string, unknown> | undefined)?.previewRequiresAuthorization
          ? t('sourcePreviewUnavailable')
          : undefined
      }
    />
  );
}
