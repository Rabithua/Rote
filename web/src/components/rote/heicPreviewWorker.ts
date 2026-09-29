import { heicTo } from 'heic-to/next';

type PreviewMessage = { type: 'loading' } | { type: 'ready'; blob: Blob } | { type: 'error' };

const worker = self as unknown as Worker;

worker.onmessage = async (event: MessageEvent<{ url: string }>) => {
  try {
    const response = await fetch(event.data.url);
    if (!response.ok) throw new Error(`HEIC fetch failed: ${response.status}`);
    worker.postMessage({ type: 'loading' } satisfies PreviewMessage);
    const blob = await heicTo({ blob: await response.blob(), type: 'image/jpeg', quality: 0.86 });
    worker.postMessage({ type: 'ready', blob } satisfies PreviewMessage);
  } catch {
    worker.postMessage({ type: 'error' } satisfies PreviewMessage);
  }
};
