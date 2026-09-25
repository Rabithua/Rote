import { useState, type SyntheticEvent } from 'react';
import { PhotoView } from 'react-photo-view';
import { AttachmentImage } from './AttachmentImage';

interface AttachmentPhotoPreviewProps {
  alt: string;
  containerClassName: string;
  crossOrigin?: 'anonymous';
  height?: number;
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

  return unavailable ? content : <PhotoView src={previewSrc}>{content}</PhotoView>;
}
