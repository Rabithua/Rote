import { cn } from '@/lib/utils';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { AttachmentImage } from './AttachmentImage';

type ConversionState = 'loading' | 'ready' | 'failed';
type WorkerMessage = { type: 'loading' } | { type: 'ready'; blob: Blob } | { type: 'error' };

const MAX_CACHED_PREVIEWS = 3;
const convertedPreviews = new Map<string, Blob>();

function cachedPreview(url: string) {
  const blob = convertedPreviews.get(url);
  if (blob) {
    convertedPreviews.delete(url);
    convertedPreviews.set(url, blob);
  }
  return blob;
}

function rememberPreview(url: string, blob: Blob) {
  convertedPreviews.delete(url);
  convertedPreviews.set(url, blob);
  if (convertedPreviews.size > MAX_CACHED_PREVIEWS) {
    const oldest = convertedPreviews.keys().next().value;
    if (oldest) convertedPreviews.delete(oldest);
  }
}

export function HeicPhotoViewer({
  attrs,
  originalSrc,
  thumbnailSrc,
}: {
  attrs: Partial<HTMLAttributes<HTMLElement>>;
  originalSrc: string;
  thumbnailSrc: string;
}) {
  const { t } = useTranslation('translation', { keyPrefix: 'components.attachments' });
  const frameRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [active, setActive] = useState(false);
  const [state, setState] = useState<ConversionState>('loading');
  const [previewSrc, setPreviewSrc] = useState(thumbnailSrc);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting && entry.intersectionRatio >= 0.5),
      { threshold: [0, 0.5] }
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active || objectUrlRef.current) return;
    const cached = cachedPreview(originalSrc);
    if (cached) {
      const url = URL.createObjectURL(cached);
      objectUrlRef.current = url;
      setPreviewSrc(url);
      setState('ready');
      return;
    }

    setState('loading');
    const worker = new Worker(new URL('./heicPreviewWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.type === 'ready') {
        rememberPreview(originalSrc, event.data.blob);
        const url = URL.createObjectURL(event.data.blob);
        objectUrlRef.current = url;
        setPreviewSrc(url);
        setState('ready');
        worker.terminate();
      } else if (event.data.type === 'error') {
        setState('failed');
        worker.terminate();
      }
    };
    worker.onerror = () => {
      setState('failed');
      worker.terminate();
    };
    worker.postMessage({ url: originalSrc });
    return () => worker.terminate();
  }, [active, originalSrc]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

  const { className, style, ...frameAttrs } = attrs;
  return (
    <div
      {...frameAttrs}
      ref={frameRef}
      className={cn('PhotoView__Photo relative overflow-hidden bg-black', className)}
      style={{ ...style, objectFit: 'contain' }}
    >
      <AttachmentImage
        className="h-full w-full object-contain select-none"
        src={previewSrc}
        alt=""
        draggable={false}
        onUnavailable={() => {
          if (previewSrc !== thumbnailSrc) {
            setPreviewSrc(thumbnailSrc);
          }
          setState('failed');
        }}
      />
      {active && state !== 'ready' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            role="status"
            className="bg-background/85 text-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm shadow-sm"
          >
            {state === 'loading' ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                {t('heicConverting')}
              </>
            ) : (
              t('heicPreviewFailed')
            )}
          </div>
        </div>
      )}
    </div>
  );
}
