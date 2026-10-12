import type { Plugin } from 'vite';
import { animatedImageFixture } from './animatedImageFixture';

const fixtureDimensions: Record<string, readonly [number, number]> = {
  'rail-a.svg': [800, 600],
  'rail-b.svg': [400, 600],
  'rail-c.svg': [1200, 600],
  'rail-landscape.svg': [1600, 900],
  'rail-portrait.svg': [600, 800],
  'rail-long.svg': [400, 1000],
  'rail-square.svg': [600, 600],
  'rail-live.svg': [900, 600],
  'rail-panorama.svg': [1800, 600],
};

export function imageLoadingPreviewServer(): Plugin {
  const requests = new Map<string, number>();
  return {
    name: 'image-loading-preview-fixtures',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (!url.pathname.startsWith('/__image-loading__/')) return next();
        const key = url.pathname + url.search;
        const count = requests.get(key) || 0;
        requests.set(key, count + 1);
        if (requests.size > 1000) requests.delete(requests.keys().next().value!);
        const sample = url.pathname.split('/').pop();
        const [width, height] =
          fixtureDimensions[sample || ''] ||
          (sample?.startsWith('long') ? [400, 1000] : [800, 600]);
        const delay = Math.min(6000, Math.max(0, Number(url.searchParams.get('delay') ?? 2400)));
        const timer = setTimeout(() => {
          if (sample === 'failure.svg' && count === 0) {
            res.writeHead(503, { 'Cache-Control': 'no-store' });
            res.end();
            return;
          }
          res.writeHead(200, {
            'Content-Type': sample === 'animation.gif' ? 'image/gif' : 'image/svg+xml',
            'Cache-Control': 'public, max-age=3600',
          });
          if (sample === 'animation.gif') {
            res.end(animatedImageFixture());
            return;
          }
          res.end(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="sky" x2="0.5" y2="1"><stop stop-color="#b9dad9"/><stop offset="1" stop-color="#d7b694"/></linearGradient></defs><path fill="url(#sky)" d="M0 0h${width}v${height}H0z"/><circle cx="${width * 0.75}" cy="${height * 0.23}" r="${width * 0.09}" fill="#fff4cf"/><path d="M0 ${height * 0.6} Q${width * 0.3} ${height * 0.25} ${width * 0.5} ${height * 0.65} T${width} ${height * 0.5} V${height} H0Z" fill="#668d82"/><path d="M0 ${height * 0.8} Q${width * 0.6} ${height * 0.4} ${width} ${height * 0.85} V${height}H0Z" fill="#3c6058"/></svg>`
          );
        }, delay);
        res.on('close', () => clearTimeout(timer));
      });
    },
  };
}
