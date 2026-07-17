import { useState } from 'react';
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
        onUnavailable={() => setFailedSrc(src)}
      />
    </div>
  );

  return unavailable ? content : <PhotoView src={previewSrc}>{content}</PhotoView>;
}
