import { cn } from '@/lib/utils';
import { ImageOff } from 'lucide-react';
import { useState, type ImgHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

type AttachmentImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  onUnavailable?: () => void;
  src?: null | string;
};

export function AttachmentImage({
  className,
  onError,
  onUnavailable,
  src,
  style,
  ...props
}: AttachmentImageProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'components.attachments' });
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const unavailable = !src || failedSrc === src;

  if (unavailable) {
    return (
      <div
        className={cn(
          'bg-foreground/5 text-muted-foreground min-h-20',
          className,
          'flex items-center justify-center'
        )}
        role="img"
        aria-label={t('imageUnavailable')}
        style={style}
      >
        <ImageOff className="size-6" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      {...props}
      className={className}
      src={src}
      style={style}
      onError={(event) => {
        setFailedSrc(src);
        onUnavailable?.();
        onError?.(event);
      }}
    />
  );
}
