import { useState, type SyntheticEvent } from 'react';
import { PhotoView } from 'react-photo-view';
import { AttachmentImage } from './AttachmentImage';
import { HeicPhotoViewer } from './HeicPhotoViewer';

interface AttachmentPhotoPreviewProps {
  alt: string;
  containerClassName: string;
  crossOrigin?: 'anonymous';
  height?: number;
  heicOriginalSrc?: string;
  imageClassName: string;
  previewSrc: string;
  src: string;
  width?: number;
  unavailableLabel?: string;
  onImageLoad?: (_event: SyntheticEvent<HTMLImageElement>) => void;
}

export function AttachmentPhotoPreview({
  alt,
  containerClassName,
  crossOrigin,
  height,
  heicOriginalSrc,
  imageClassName,
  previewSrc,
  src,
  width,
  unavailableLabel,
  onImageLoad,
}: AttachmentPhotoPreviewProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const unavailable = !previewSrc || !src || failedSrc === src;
  const content = (
    <div className={containerClassName}>
      <AttachmentImage
        className={imageClassName}
        crossOrigin={crossOrigin}
        height={height}
        width={width}
        src={unavailable ? '' : src}
        alt={alt}
        draggable={false}
        onUnavailable={() => setFailedSrc(src)}
        onLoad={onImageLoad}
        unavailableLabel={unavailableLabel}
      />
    </div>
  );

  if (unavailable) return content;

  if (heicOriginalSrc) {
    const viewerWidth = typeof window === 'undefined' ? 1280 : Math.max(1, window.innerWidth - 32);
    const viewerHeight = typeof window === 'undefined' ? 960 : Math.max(1, window.innerHeight - 64);
    return (
      <PhotoView
        width={viewerWidth}
        height={viewerHeight}
        render={({ attrs }) => (
          <HeicPhotoViewer attrs={attrs} originalSrc={heicOriginalSrc} thumbnailSrc={previewSrc} />
        )}
      >
        {content}
      </PhotoView>
    );
  }

  return <PhotoView src={previewSrc}>{content}</PhotoView>;
}
