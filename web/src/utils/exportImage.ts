import { toBlob } from 'html-to-image';

const MAX_CANVAS_AREA = 160000000;
const MAX_DIMENSION = 65535;
const CHUNK_HEIGHT = 2000;

export function logExport(step: string, data?: Record<string, unknown>) {
  const ts = new Date().toISOString().slice(11, 23);
  const prefix = `[Export ${ts}]`;
  if (data) {
    // eslint-disable-next-line no-console
    console.log(`${prefix} ${step}`, data);
  } else {
    // eslint-disable-next-line no-console
    console.log(`${prefix} ${step}`);
  }
}

export function logExportError(step: string, error?: unknown) {
  const ts = new Date().toISOString().slice(11, 23);
  const prefix = `[Export ${ts}]`;
  if (error instanceof Error) {
    // eslint-disable-next-line no-console
    console.error(`${prefix} ✗ ${step}`, { message: error.message, name: error.name });
  } else if (error) {
    // eslint-disable-next-line no-console
    console.error(`${prefix} ✗ ${step}`, error);
  } else {
    // eslint-disable-next-line no-console
    console.error(`${prefix} ✗ ${step}`);
  }
}

export async function toDataURL(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

export async function waitForImagesToLoad(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll('img'));
  const promises = images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 5000);
      img.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      img.onerror = () => {
        clearTimeout(timeout);
        resolve();
      };
    });
  });
  await Promise.all(promises);
}

export function calculateScale(width: number, height: number) {
  const currentArea = width * height;
  const maxAreaScale = Math.sqrt(MAX_CANVAS_AREA / currentArea);
  const maxDimScale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
  const safeScale = Math.min(maxAreaScale, maxDimScale);

  let scale = 4;
  if (scale > safeScale) {
    scale = Math.floor(safeScale * 2) / 2;
    if (scale < 1) scale = 1;
  }
  return scale;
}

export async function captureElementToPng(el: HTMLElement, scale: number): Promise<Blob> {
  const rect = el.getBoundingClientRect();
  const chunksCount = Math.ceil(rect.height / CHUNK_HEIGHT);

  const masterCanvas = document.createElement('canvas');
  masterCanvas.width = rect.width * scale;
  masterCanvas.height = rect.height * scale;
  const masterCtx = masterCanvas.getContext('2d');
  if (!masterCtx) throw new Error('Cannot create master canvas context');
  masterCtx.imageSmoothingEnabled = false;

  for (let i = 0; i < chunksCount; i++) {
    const currentChunkHeight = Math.min(CHUNK_HEIGHT, rect.height - i * CHUNK_HEIGHT);

    const chunkBlob = await toBlob(el, {
      pixelRatio: scale,
      backgroundColor: '#ffffff',
      width: rect.width,
      height: currentChunkHeight,
      style: {
        left: '0',
        top: '0',
        margin: '0',
        transform: `translateY(-${i * CHUNK_HEIGHT}px)`,
        transformOrigin: 'top left',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      } as any,
    });

    if (!chunkBlob || chunkBlob.size === 0) throw new Error(`Empty image chunk ${i}`);

    const img = new Image();
    const url = URL.createObjectURL(chunkBlob);
    img.src = url;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });

    masterCtx.drawImage(
      img,
      0,
      i * CHUNK_HEIGHT * scale,
      rect.width * scale,
      currentChunkHeight * scale
    );
    URL.revokeObjectURL(url);
  }

  const finalBlob = await new Promise<Blob | null>((resolve) => {
    masterCanvas.toBlob(resolve, 'image/png');
  });

  if (!finalBlob || finalBlob.size === 0) throw new Error('Empty image');
  return finalBlob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function cleanupOffscreenContainers() {
  document.body
    .querySelectorAll('[style*="left:-9999px"], [style*="left: -9999px"]')
    .forEach((el) => el.remove());
}
