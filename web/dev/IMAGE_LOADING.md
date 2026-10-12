# Image loading preview

Run from `web/` on an unused local port:

```sh
ROTE_IMAGE_LOADING_PREVIEW=1 bun run dev -- --host 127.0.0.1 --port 3012
```

Open `http://127.0.0.1:3012/image-loading-preview.html`. Add `?slow` to inspect transitions at 10% speed; omit it for the normal 300ms transitions. This standalone entry uses the real thumbnail and avatar components with the app's Strict Mode enabled, without loading an account. Fixtures have delayed responses and a dedicated URL namespace; replay creates fresh fixture URLs. The preview flag disables development Service Worker registration on this server. Use an unused port so an existing app Service Worker cannot replace the preview with the app shell; do not clear user caches.

- The first rail has no width or height metadata. Its fixtures are landscape 16:9, portrait 3:4, tall 2:5, square, a Live Photo still 3:2, and panorama 3:1, in that order. Replay loading: unknown images begin square, then the loaded proportions adjust each item's width while the rail height stays fixed. The ratio range is 0.4–2.0, so the 3:1 panorama is cropped to 2:1. The Live Photo fixture covers its still thumbnail and badge, with no paired video.
- Replay at the top: avatars, cover, link thumbnail and the rail with known dimensions breathe before synchronously crossfading. Fixed frames and the rail with known dimensions retain their measurements.
- Replay, then scroll to the long image before its 4.2-second response: the existing placeholder adjusts its ratio smoothly, then crossfades. Its breathing layer remains the same node and keeps its animation progress.
- Replay and remain at the top until the long image loads below the viewport: its first display uses the natural portrait ratio. An image that has never been visible must not cache a frozen fallback.
- With `?slow`, leave the long image during its size transition: its current bounds freeze immediately. Row height and the subsequent scroll position must remain unchanged, including after a real unmount and remount.
- Show cached images again: successful images are immediate. The same settled geometry is reused, including natural proportions in the first rail. This remount uses the same fixture URLs; replay creates new URLs to exercise unknown proportions again.
- Tap either corner or an edge of the failed image: the entire pale-red region reloads. It must not open a preview. Once recovered, clicking the image opens its original preview.
- Replay, scroll past pending images, and retain a visible anchor: late loads must not resize departed rows or move the anchor. Returning to those rows retains the frozen geometry.
- Emulate reduced motion: the placeholder remains visible without breathing and resizing/reveal transitions are immediate. Offscreen placeholders and hidden documents pause breathing.

Breathing uses foreground opacity from 8% to 14% over a 3.4-second cycle; reduced motion uses a static 11%.

The preview HTML and middleware are development-only; the production build keeps its existing entry and full-screen preview behavior. `data-image-state`, `data-image-reveal` and `data-image-active` expose DOM presentation states for inspection.
