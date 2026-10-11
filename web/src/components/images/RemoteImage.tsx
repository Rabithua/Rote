import { cn } from '@/lib/utils';
import { ImageOff } from 'lucide-react';
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type SyntheticEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { getSettledImageRatio, settleImageRatio } from './imageGeometry';
import { imageIsVisible, useImageActivity } from './useImageActivity';
import './RemoteImage.css';

export type RemoteImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
  imageClassName?: string;
  intrinsic?: boolean;
  aspectRatio?: number;
  layoutKey?: string;
  allowsRetry?: boolean;
  unavailableLabel?: string;
  onUnavailable?: () => void;
  onReady?: (_image: HTMLImageElement) => void;
};

type Phase = 'loading' | 'resizing' | 'revealing' | 'ready' | 'error';

export function RemoteImage(props: RemoteImageProps) {
  return <ImageSurface key={props.src || ''} {...props} />;
}

function ImageSurface({
  src,
  className,
  imageClassName,
  intrinsic = false,
  aspectRatio,
  layoutKey,
  allowsRetry = false,
  unavailableLabel,
  style,
  onLoad,
  onError,
  onUnavailable,
  onReady,
  ...props
}: RemoteImageProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'components.images' });
  const surface = useRef<HTMLSpanElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const geometryKey = layoutKey || src || '';
  const [ratio, setRatio] = useState(
    () => getSettledImageRatio(geometryKey) ?? aspectRatio ?? 4 / 3
  );
  const ratioRef = useRef(ratio);
  const geometryLocked = useRef(Boolean(aspectRatio || getSettledImageRatio(geometryKey)));
  const placeholderWasVisible = useRef(false);
  const phaseRef = useRef<Phase>(src ? 'loading' : 'error');
  const [phase, setPhase] = useState(phaseRef.current);
  const [fade, setFade] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const readyNotified = useRef(false);
  const updatePhase = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  const freezeGeometry = useCallback(() => {
    if (!intrinsic) return;
    geometryLocked.current = true;
    settleImageRatio(geometryKey, ratioRef.current);
  }, [geometryKey, intrinsic]);
  const recordPlaceholder = useCallback(() => {
    if (phaseRef.current === 'loading' || phaseRef.current === 'resizing') {
      placeholderWasVisible.current = true;
    }
  }, []);
  useImageActivity(surface, recordPlaceholder, freezeGeometry, attempt);

  const reveal = () => {
    const shouldFade =
      placeholderWasVisible.current &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setFade(shouldFade);
    updatePhase(shouldFade ? 'revealing' : 'ready');
  };
  const loaded = (element: HTMLImageElement) => {
    if (phaseRef.current !== 'loading') return;
    const naturalRatio = element.naturalWidth / element.naturalHeight;
    if (intrinsic && !geometryLocked.current && Number.isFinite(naturalRatio) && naturalRatio > 0) {
      const visible = imageIsVisible(surface.current);
      geometryLocked.current = true;
      if (visible) {
        const changesSize = Math.abs(ratioRef.current - naturalRatio) > 0.001;
        ratioRef.current = naturalRatio;
        setRatio(naturalRatio);
        settleImageRatio(geometryKey, naturalRatio);
        if (
          changesSize &&
          placeholderWasVisible.current &&
          !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
          updatePhase('resizing');
          return;
        }
      } else {
        freezeGeometry();
      }
    }
    reveal();
  };

  // A complete image is checked before paint, including a recycled cache hit.
  useLayoutEffect(() => {
    if (image.current?.complete && image.current.naturalWidth > 0) loaded(image.current);
    if (phaseRef.current === 'ready' && image.current && !readyNotified.current) {
      readyNotified.current = true;
      onReady?.(image.current);
    }
  });

  const failed = (event: SyntheticEvent<HTMLImageElement>) => {
    freezeGeometry();
    updatePhase('error');
    onUnavailable?.();
    onError?.(event);
  };
  const retry = (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    placeholderWasVisible.current = false;
    readyNotified.current = false;
    setFade(false);
    updatePhase('loading');
    setAttempt((current) => current + 1);
  };
  const failureContent = (
    <>
      <ImageOff aria-hidden="true" />
      {unavailableLabel && <span className="px-3 text-xs leading-relaxed">{unavailableLabel}</span>}
    </>
  );

  return (
    <span
      ref={surface}
      className={cn('remote-image', className, intrinsic && 'remote-image--intrinsic')}
      data-image-state={phase}
      data-image-reveal={fade ? 'fade' : 'immediate'}
      style={{ ...style, ...(intrinsic ? { aspectRatio: ratio } : {}) }}
      onTransitionEnd={(event) => {
        if (
          event.target === surface.current &&
          event.propertyName === 'aspect-ratio' &&
          phaseRef.current === 'resizing'
        ) {
          reveal();
        }
        if (event.propertyName === 'opacity' && phaseRef.current === 'revealing') {
          updatePhase('ready');
        }
      }}
      onTransitionCancel={(event) => {
        if (event.propertyName === 'aspect-ratio' && phaseRef.current === 'resizing') reveal();
        if (event.propertyName === 'opacity' && phaseRef.current === 'revealing')
          updatePhase('ready');
      }}
    >
      {phase !== 'error' && src && (
        <img
          {...props}
          key={attempt}
          ref={image}
          src={src}
          className={cn('remote-image__content object-cover', imageClassName)}
          onLoad={(event) => {
            onLoad?.(event);
            loaded(event.currentTarget);
          }}
          onError={failed}
        />
      )}
      <span className="remote-image__placeholder" aria-hidden="true">
        <span className="remote-image__breath" />
      </span>
      {phase === 'error' &&
        (allowsRetry && src ? (
          <button
            type="button"
            className="remote-image__failure"
            data-image-retry
            aria-label={t('retry')}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={retry}
          >
            {failureContent}
          </button>
        ) : (
          <span
            className="remote-image__failure"
            role="img"
            aria-label={unavailableLabel || t('unavailable')}
            onClick={(event) => {
              if (allowsRetry) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
          >
            {failureContent}
          </span>
        ))}
    </span>
  );
}
