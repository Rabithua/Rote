import { cn } from '@/lib/utils';
import type { Attachment } from '@/types/main';
import { getAttachmentLivePhotoPlaybackSrc } from '@/utils/directUpload';
import { SunMedium } from 'lucide-react';
import { useEffect, useMemo, useState, type ComponentProps, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PhotoView } from 'react-photo-view';
import {
  getLivePhotoPreviewSize,
  LivePhotoMotionViewer,
  LivePhotoStillViewer,
} from './LivePhotoViewer';
import { AttachmentImage } from './AttachmentImage';

type PhotoRenderParams = Parameters<NonNullable<ComponentProps<typeof PhotoView>['render']>>[0];

const DEFAULT_PREVIEW_SIZE = {
  width: 1280,
  height: 960,
};
const DEFAULT_VIEWPORT_SIZE = {
  width: 1280,
  height: 720,
};

function getViewportSize() {
  if (typeof window === 'undefined') {
    return DEFAULT_VIEWPORT_SIZE;
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

interface LivePhotoAttachmentPreviewProps {
  attachment: Attachment;
  previewSrc: string;
  thumbnailSrc: string;
  className?: string;
  imageClassName?: string;
  badgeClassName?: string;
  crossOrigin?: 'anonymous';
}

function LivePhotoStill({
  thumbnailSrc,
  imageClassName,
  badgeClassName,
  crossOrigin,
  badgeLabel,
  onLoad,
  onUnavailable,
}: Pick<
  LivePhotoAttachmentPreviewProps,
  'thumbnailSrc' | 'imageClassName' | 'badgeClassName' | 'crossOrigin'
> & {
  badgeLabel: string;
  onLoad?: (_event: SyntheticEvent<HTMLImageElement>) => void;
  onUnavailable?: () => void;
}) {
  return (
    <>
      <AttachmentImage
        className={imageClassName}
        src={thumbnailSrc}
        crossOrigin={crossOrigin}
        alt=""
        draggable={false}
        onLoad={onLoad}
        onUnavailable={onUnavailable}
      />
      <span
        className={cn(
          'absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-normal text-white',
          badgeClassName
        )}
      >
        <SunMedium className="size-3" />
        {badgeLabel}
      </span>
    </>
  );
}

export function LivePhotoAttachmentPreview({
  attachment,
  previewSrc,
  thumbnailSrc,
  className,
  imageClassName,
  badgeClassName,
  crossOrigin,
}: LivePhotoAttachmentPreviewProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'components.attachments.livePhoto' });
  const [stillSize, setStillSize] = useState(DEFAULT_PREVIEW_SIZE);
  const [failedStillSrc, setFailedStillSrc] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState(getViewportSize);
  const [videoFailed, setVideoFailed] = useState(false);
  const playbackSrc = getAttachmentLivePhotoPlaybackSrc(attachment);
  const previewSize = useMemo(
    () => getLivePhotoPreviewSize(stillSize.width, stillSize.height, viewportSize),
    [stillSize.height, stillSize.width, viewportSize]
  );
  const stillUnavailable = !previewSrc || !thumbnailSrc || failedStillSrc === thumbnailSrc;

  useEffect(() => {
    setVideoFailed(false);
  }, [playbackSrc]);

  useEffect(() => {
    const handleResize = () => setViewportSize(getViewportSize());
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleStillLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) return;

    setStillSize((current) => {
      if (current.width === naturalWidth && current.height === naturalHeight) {
        return current;
      }

      return {
        width: naturalWidth,
        height: naturalHeight,
      };
    });
  };

  const renderLivePhoto = ({ attrs }: PhotoRenderParams) => {
    if (videoFailed) {
      return <LivePhotoStillViewer attrs={attrs} previewSrc={previewSrc} />;
    }

    return (
      <LivePhotoMotionViewer
        attrs={attrs}
        playbackSrc={playbackSrc}
        previewSrc={previewSrc}
        videoLabel={t('videoLabel')}
        onVideoError={() => setVideoFailed(true)}
      />
    );
  };

  if (stillUnavailable) {
    return (
      <div className={cn('relative grow overflow-hidden', className)}>
        <LivePhotoStill
          thumbnailSrc=""
          imageClassName={imageClassName}
          badgeClassName={badgeClassName}
          crossOrigin={crossOrigin}
          badgeLabel={t('badge')}
        />
      </div>
    );
  }

  if (!playbackSrc) {
    return (
      <PhotoView src={previewSrc}>
        <div className={cn('relative grow overflow-hidden', className)}>
          <LivePhotoStill
            thumbnailSrc={thumbnailSrc}
            imageClassName={imageClassName}
            badgeClassName={badgeClassName}
            crossOrigin={crossOrigin}
            badgeLabel={t('badge')}
            onLoad={handleStillLoad}
            onUnavailable={() => setFailedStillSrc(thumbnailSrc)}
          />
        </div>
      </PhotoView>
    );
  }

  return (
    <PhotoView
      key={`${previewSrc}-${playbackSrc}-${previewSize.width}x${previewSize.height}`}
      render={renderLivePhoto}
      width={previewSize.width}
      height={previewSize.height}
    >
      <div
        className={cn(
          'relative grow cursor-zoom-in overflow-hidden focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none',
          className
        )}
        aria-label={t('open')}
      >
        <LivePhotoStill
          thumbnailSrc={thumbnailSrc}
          imageClassName={imageClassName}
          badgeClassName={badgeClassName}
          crossOrigin={crossOrigin}
          badgeLabel={t('badge')}
          onLoad={handleStillLoad}
          onUnavailable={() => setFailedStillSrc(thumbnailSrc)}
        />
      </div>
    </PhotoView>
  );
}
