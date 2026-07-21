import { cn } from '@/lib/utils';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent,
  type TouchEvent,
} from 'react';
import { AttachmentImage } from './AttachmentImage';

export type LivePhotoRenderAttrs = Partial<HTMLAttributes<HTMLElement>>;

const DEFAULT_VIEWPORT_SIZE = {
  width: 1280,
  height: 720,
};
const VIEWER_HORIZONTAL_PADDING = 32;
const VIEWER_VERTICAL_PADDING = 64;
const LIVE_PHOTO_PRESS_DELAY_MS = 180;

export function getLivePhotoPreviewSize(
  width: number,
  height: number,
  viewportSize = DEFAULT_VIEWPORT_SIZE
) {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const maxWidth = Math.max(1, viewportSize.width - VIEWER_HORIZONTAL_PADDING);
  const maxHeight = Math.max(1, viewportSize.height - VIEWER_VERTICAL_PADDING);
  const scale = Math.min(1, maxWidth / safeWidth, maxHeight / safeHeight);

  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

function getPhotoViewFrameProps(attrs: LivePhotoRenderAttrs) {
  const { className, style, ...frameAttrs } = attrs;
  const frameStyle: CSSProperties = {
    ...(style as CSSProperties | undefined),
    objectFit: 'contain',
  };

  return {
    className: cn('PhotoView__Photo relative overflow-hidden bg-black', className),
    style: frameStyle,
    frameAttrs,
  };
}

export function LivePhotoStillViewer({
  attrs,
  previewSrc,
}: {
  attrs: LivePhotoRenderAttrs;
  previewSrc: string;
}) {
  const { className, style, frameAttrs } = getPhotoViewFrameProps(attrs);

  return (
    <div {...frameAttrs} className={className} style={style}>
      <AttachmentImage
        className="h-full w-full object-contain select-none"
        src={previewSrc}
        alt=""
        draggable={false}
      />
    </div>
  );
}

export function LivePhotoMotionViewer({
  attrs,
  playbackSrc,
  previewSrc,
  videoLabel,
  onVideoError,
}: {
  attrs: LivePhotoRenderAttrs;
  playbackSrc: string;
  previewSrc: string;
  videoLabel: string;
  onVideoError: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { className, style, frameAttrs } = getPhotoViewFrameProps(attrs);

  const clearPressTimer = useCallback(() => {
    if (!pressTimerRef.current) return;
    clearTimeout(pressTimerRef.current);
    pressTimerRef.current = null;
  }, []);

  const resetVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    if (Number.isFinite(video.duration)) {
      video.currentTime = 0;
    }
  }, []);

  const stopMotion = useCallback(() => {
    clearPressTimer();
    resetVideo();
    setIsPlaying(false);
  }, [clearPressTimer, resetVideo]);

  const startMotion = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsPlaying(true);
    video.currentTime = 0;
    void video.play().catch(() => {
      setIsPlaying(false);
    });
  }, []);

  const queueMotionStart = useCallback(() => {
    clearPressTimer();
    pressTimerRef.current = setTimeout(startMotion, LIVE_PHOTO_PRESS_DELAY_MS);
  }, [clearPressTimer, startMotion]);

  useEffect(() => {
    stopMotion();
  }, [playbackSrc, previewSrc, stopMotion]);

  useEffect(
    () => () => {
      clearPressTimer();
      resetVideo();
    },
    [clearPressTimer, resetVideo]
  );

  useEffect(() => {
    const handleRelease = () => stopMotion();
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopMotion();
      }
    };

    window.addEventListener('blur', handleRelease);
    window.addEventListener('mouseup', handleRelease);
    window.addEventListener('touchend', handleRelease);
    window.addEventListener('touchcancel', handleRelease);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleRelease);
      window.removeEventListener('mouseup', handleRelease);
      window.removeEventListener('touchend', handleRelease);
      window.removeEventListener('touchcancel', handleRelease);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [stopMotion]);

  const handleMouseDown = (event: MouseEvent<HTMLElement>) => {
    frameAttrs.onMouseDown?.(event);
    if (event.defaultPrevented || event.button !== 0) return;
    queueMotionStart();
  };

  const handleMouseUp = (event: MouseEvent<HTMLElement>) => {
    frameAttrs.onMouseUp?.(event);
    stopMotion();
  };

  const handleMouseLeave = (event: MouseEvent<HTMLElement>) => {
    frameAttrs.onMouseLeave?.(event);
    stopMotion();
  };

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    frameAttrs.onTouchStart?.(event);
    if (event.defaultPrevented || event.touches.length !== 1) return;
    queueMotionStart();
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    frameAttrs.onTouchEnd?.(event);
    stopMotion();
  };

  const handleTouchCancel = (event: TouchEvent<HTMLElement>) => {
    frameAttrs.onTouchCancel?.(event);
    stopMotion();
  };

  return (
    <div
      {...frameAttrs}
      className={className}
      style={style}
      aria-label={videoLabel}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <AttachmentImage
        className="h-full w-full object-contain select-none"
        src={previewSrc}
        alt=""
        draggable={false}
      />
      <video
        ref={videoRef}
        className={cn(
          'pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-100',
          isPlaying ? 'opacity-100' : 'opacity-0'
        )}
        src={playbackSrc}
        poster={previewSrc || undefined}
        playsInline
        preload="metadata"
        aria-hidden={!isPlaying}
        onEnded={stopMotion}
        onError={() => {
          stopMotion();
          onVideoError();
        }}
      />
    </div>
  );
}
