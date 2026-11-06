import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { authPreviewApi } from './auth-preview/api';
import { previewPage, successPage } from './auth-preview/pages';

export function authPreviewServer(): Plugin {
  const enabled = process.env.ROTE_AUTH_PREVIEW === '1';
  const api = authPreviewApi();
  return {
    name: 'auth-preview-fixtures',
    apply: 'serve',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        enabled
          ? {
              html: html.replace(/<!-- React Scan - Development only -->[\s\S]*?<\/script>/, ''),
              tags: [
                {
                  tag: 'script',
                  attrs: { src: '/__auth-preview/client.js' },
                  injectTo: 'head-prepend',
                },
              ],
            }
          : html,
    },
    configureServer(server) {
      if (!enabled) return;
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        if (url.pathname.startsWith('/v2/api/')) {
          void api(req, res, url).catch(next);
          return;
        }
        const pages: Record<string, () => string> = {
          '/__auth-preview': previewPage,
          '/__auth-preview/': previewPage,
          '/__auth-preview/success': successPage,
        };
        if (url.pathname === '/__auth-preview/client.js') {
          res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
          res.end(readFileSync(new URL('./auth-preview/client.js', import.meta.url), 'utf8'));
        } else if (pages[url.pathname]) {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          });
          res.end(pages[url.pathname]());
        } else next();
      });
    },
  };
}
