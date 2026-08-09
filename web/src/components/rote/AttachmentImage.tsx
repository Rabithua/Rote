import { cn } from '@/lib/utils';
import { ImageOff } from 'lucide-react';
import { useState, type ImgHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

type AttachmentImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  onUnavailable?: () => void;
  src?: null | string;
  unavailableLabel?: string;
};

export function AttachmentImage({
  className,
  onError,
  onUnavailable,
  src,
  style,
  unavailableLabel,
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
          'flex flex-col items-center justify-center gap-1.5 p-3 text-center'
        )}
        role="img"
        aria-label={unavailableLabel ?? t('imageUnavailable')}
        style={style}
      >
        <ImageOff className="size-6" aria-hidden="true" />
        {unavailableLabel && <span className="text-xs leading-relaxed">{unavailableLabel}</span>}
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
