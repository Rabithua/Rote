import { cn } from '@/lib/utils';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useRef, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

function videoDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

interface VideoAttachmentPreviewProps {
  posterSrc?: null | string;
  playbackSrc?: null | string;
  className?: string;
  mediaClassName?: string;
  disabled?: boolean;
  stopInteractionPropagation?: boolean;
  onLoadedMetadata?: (_event: SyntheticEvent<HTMLVideoElement>) => void;
  railOverlay?: boolean;
}

export function VideoAttachmentPreview({
  posterSrc,
  playbackSrc,
  className,
  mediaClassName,
  disabled = false,
  stopInteractionPropagation = false,
  onLoadedMetadata,
  railOverlay = false,
}: VideoAttachmentPreviewProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'components.attachments' });
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [duration, setDuration] = useState(0);
  const stopPropagation = (event: { stopPropagation: () => void }) => {
    if (stopInteractionPropagation) {
      event.stopPropagation();
    }
  };
  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  };

  if (!playbackSrc || disabled) {
    if (posterSrc) {
      return (
        <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
          <img
            className={cn('h-full w-full bg-black object-contain', mediaClassName)}
            src={posterSrc}
            alt=""
          />
        </div>
      );
    }

    return <div className={cn('h-full w-full bg-black', className)} />;
  }

  return (
    <div className={cn('group relative h-full w-full overflow-hidden bg-black', className)}>
      <video
        ref={videoRef}
        className={cn('h-full w-full bg-black object-contain', mediaClassName)}
        controls={!railOverlay}
        muted={railOverlay ? muted : undefined}
        playsInline
        onPointerDown={railOverlay ? undefined : stopPropagation}
        onClick={railOverlay ? togglePlayback : stopPropagation}
        poster={posterSrc || undefined}
        preload="metadata"
        src={playbackSrc}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          onLoadedMetadata?.(event);
        }}
      />
      {railOverlay && (
        <>
          <button
            type="button"
            className={cn(
              'absolute top-1/2 left-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm',
              playing && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
            )}
            aria-label={playing ? t('pauseVideo') : t('playVideo')}
            onClick={togglePlayback}
          >
            {playing ? (
              <Pause className="size-5" fill="currentColor" />
            ) : (
              <Play className="size-5 translate-x-0.5" fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            className="absolute bottom-2 left-2 flex size-10 items-center justify-center rounded-md bg-black/65 text-white"
            aria-label={muted ? t('unmuteVideo') : t('muteVideo')}
            onClick={() => setMuted((current) => !current)}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <span className="absolute right-2 bottom-2 rounded-md bg-black/65 px-2 py-1 text-xs text-white tabular-nums">
            {videoDuration(duration)}
          </span>
        </>
      )}
    </div>
  );
}
