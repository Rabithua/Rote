# Image loading preview

Run from `web/` on an unused local port:

```sh
ROTE_IMAGE_LOADING_PREVIEW=1 bun run dev -- --host 127.0.0.1 --port 3012
```

Open `http://127.0.0.1:3012/image-loading-preview.html`. Add `?slow` to inspect transitions at 10% speed. This standalone entry uses the real thumbnail and avatar components without loading an account. Fixtures have delayed responses and a dedicated URL namespace; replay creates fresh fixture URLs. The preview flag disables development Service Worker registration on this server. Use an unused port so an existing app Service Worker cannot replace the preview with the app shell; do not clear user caches.

- Replay at the top: avatars, cover, link thumbnail and media rail breathe before synchronously crossfading. Fixed frames and the rail retain their measurements.
- Replay, then scroll to the long image before its 4.2-second response: the existing placeholder adjusts its ratio smoothly, then crossfades. Its breathing layer remains the same node and keeps its animation progress.
- Show cached images again: successful images are immediate. The same settled geometry is reused.
- Tap either corner or an edge of the failed image: the entire pale-red region reloads. It must not open a preview. Once recovered, clicking the image opens its original preview.
- Replay, scroll past pending images, and retain a visible anchor: late loads must not resize departed rows or move the anchor. Returning to those rows retains the frozen geometry.
- Emulate reduced motion: the placeholder remains visible without breathing and resizing/reveal transitions are immediate. Offscreen placeholders and hidden documents pause breathing.

The preview HTML and middleware are development-only; the production build keeps its existing entry and full-screen preview behavior. `data-image-state`, `data-image-reveal` and `data-image-active` expose DOM presentation states for inspection.
