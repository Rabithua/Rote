import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteImage } from './RemoteImage';

describe('RemoteImage presentation', () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextFrameId: number;
  let visibilityChanged: () => void;
  let visible: boolean;
  const paint = () => {
    for (let i = 0; i < 2; i++) {
      const pending = [...frames];
      act(() => {
        for (const [id, callback] of pending) {
          if (frames.delete(id)) callback(performance.now());
        }
      });
    }
  };
  const load = (container: HTMLElement, width = 400, height = 300) => {
    const image = container.querySelector('img')!;
    Object.defineProperties(image, {
      naturalWidth: { configurable: true, value: width },
      naturalHeight: { configurable: true, value: height },
    });
    fireEvent.load(image);
  };

  beforeEach(() => {
    frames = new Map();
    nextFrameId = 0;
    visible = true;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          width: 400,
          height: 300,
          top: visible ? 0 : -1000,
          bottom: visible ? 300 : -700,
          left: 0,
          right: 400,
        }) as DOMRect
    );
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = ++nextFrameId;
      frames.set(id, callback);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      frames.delete(id);
    });
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false);
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: () => void) {
          visibilityChanged = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it('reveals a synchronous decoded cache hit before a placeholder paints', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(300);
    const { container } = render(<RemoteImage src="cached.png" className="size-full" />);
    expect(container.firstChild).toHaveAttribute('data-image-state', 'ready');
    expect(container.firstChild).toHaveAttribute('data-image-reveal', 'immediate');
  });

  it('crossfades after a visible placeholder even when the same source was displayed before', () => {
    const first = render(<RemoteImage src="recycled.png" />);
    load(first.container);
    first.unmount();
    const second = render(<RemoteImage src="recycled.png" />);
    paint();
    load(second.container);
    expect(second.container.firstChild).toHaveAttribute('data-image-state', 'revealing');
    expect(second.container.firstChild).toHaveAttribute('data-image-reveal', 'fade');
  });

  it('keeps the breathing node throughout geometry adjustment and reveals only after it settles', () => {
    const { container } = render(<RemoteImage src="long.png" intrinsic />);
    const breath = container.querySelector('.remote-image__breath');
    paint();
    load(container, 400, 1000);
    expect(container.firstChild).toHaveAttribute('data-image-state', 'resizing');
    expect(container.firstChild).toHaveStyle({ aspectRatio: '0.4' });
    expect(container.querySelector('.remote-image__breath')).toBe(breath);
    fireEvent.transitionEnd(container.firstChild!, { propertyName: 'aspect-ratio' });
    expect(container.firstChild).toHaveAttribute('data-image-state', 'revealing');
    expect(container.querySelector('.remote-image__breath')).toBe(breath);
  });

  it('settles a first visible portrait through resizing and reveal in Strict Mode', () => {
    const { container } = render(
      <StrictMode>
        <RemoteImage src="strict-visible-portrait.png" intrinsic />
      </StrictMode>
    );
    const surface = container.firstChild!;
    const breath = container.querySelector('.remote-image__breath');
    expect(surface).toHaveAttribute('data-image-state', 'loading');
    paint();
    load(container, 400, 1000);
    expect(surface).toHaveStyle({ aspectRatio: '0.4' });
    expect(surface).toHaveAttribute('data-image-state', 'resizing');
    expect(container.querySelector('.remote-image__breath')).toBe(breath);
    fireEvent.transitionEnd(surface, { propertyName: 'aspect-ratio' });
    expect(surface).toHaveAttribute('data-image-state', 'revealing');
    expect(surface).toHaveAttribute('data-image-reveal', 'fade');
    expect(container.querySelector('.remote-image__breath')).toBe(breath);
    fireEvent.transitionEnd(container.querySelector('img')!, { propertyName: 'opacity' });
    expect(surface).toHaveAttribute('data-image-state', 'ready');
    expect(container.querySelector('.remote-image__breath')).toBe(breath);
  });

  it('uses natural geometry before an initially offscreen image has ever been visible', () => {
    visible = false;
    const first = render(<RemoteImage src="initially-offscreen.png" intrinsic />);
    paint();
    load(first.container, 400, 1000);
    expect(first.container.firstChild).toHaveStyle({ aspectRatio: '0.4' });
    expect(first.container.firstChild).toHaveAttribute('data-image-state', 'ready');
    expect(first.container.firstChild).toHaveAttribute('data-image-reveal', 'immediate');
    first.unmount();
    visible = true;
    const second = render(<RemoteImage src="initially-offscreen.png" intrinsic />);
    expect(second.container.firstChild).toHaveStyle({ aspectRatio: '0.4' });
    load(second.container, 400, 1000);
    expect(second.container.firstChild).toHaveAttribute('data-image-state', 'ready');
  });

  it('does not freeze an unseen image when it really unmounts before loading', () => {
    visible = false;
    const first = render(<RemoteImage src="unseen-unmounted.png" intrinsic />);
    paint();
    first.unmount();
    visible = true;
    const second = render(<RemoteImage src="unseen-unmounted.png" intrinsic />);
    paint();
    load(second.container, 400, 1000);
    expect(second.container.firstChild).toHaveStyle({ aspectRatio: '0.4' });
    expect(second.container.firstChild).toHaveAttribute('data-image-state', 'resizing');
  });

  it('retains painted geometry after a real unmount and late load on remount', () => {
    const first = render(<RemoteImage src="visible-unmounted.png" intrinsic />);
    paint();
    first.unmount();
    const second = render(<RemoteImage src="visible-unmounted.png" intrinsic />);
    paint();
    load(second.container, 400, 1000);
    expect(second.container.firstChild).toHaveStyle({ aspectRatio: String(4 / 3) });
    expect(second.container.firstChild).toHaveAttribute('data-image-state', 'revealing');
  });

  it('retains geometry when a visible loading row departs and returns before loading', () => {
    const { container } = render(<RemoteImage src="departed-returned.png" intrinsic />);
    paint();
    visible = false;
    act(() => visibilityChanged());
    visible = true;
    act(() => visibilityChanged());
    paint();
    load(container, 400, 1000);
    expect(container.firstChild).toHaveStyle({ aspectRatio: String(4 / 3) });
    expect(container.firstChild).toHaveAttribute('data-image-state', 'revealing');
  });

  it('retains painted geometry when load arrives before the observer reports departure', () => {
    const { container } = render(
      <RemoteImage src="load-before-departure-observer.png" intrinsic />
    );
    paint();
    visible = false;
    load(container, 400, 1000);
    expect(container.firstChild).toHaveStyle({ aspectRatio: String(4 / 3) });
    visible = true;
    act(() => visibilityChanged());
    expect(container.firstChild).toHaveStyle({ aspectRatio: String(4 / 3) });
  });

  it('freezes the rendered ratio when a row leaves during geometry interpolation', () => {
    const first = render(<RemoteImage src="departed-during-resize.png" intrinsic />);
    const surface = first.container.firstChild as HTMLElement;
    paint();
    load(first.container, 400, 1000);
    expect(surface).toHaveAttribute('data-image-state', 'resizing');
    visible = false;
    const bounds = vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 500,
      top: -1000,
      bottom: -500,
      left: 0,
      right: 400,
    } as DOMRect);
    act(() => visibilityChanged());
    expect(surface).toHaveStyle({ aspectRatio: '0.8' });
    expect(surface).toHaveAttribute('data-image-state', 'ready');
    expect(surface).toHaveAttribute('data-image-reveal', 'immediate');
    visible = true;
    bounds.mockReturnValue({
      width: 400,
      height: 500,
      top: 0,
      bottom: 500,
      left: 0,
      right: 400,
    } as DOMRect);
    act(() => visibilityChanged());
    fireEvent.transitionEnd(surface, { propertyName: 'aspect-ratio' });
    fireEvent.transitionEnd(first.container.querySelector('img')!, { propertyName: 'opacity' });
    expect(surface).toHaveStyle({ aspectRatio: '0.8' });
    expect(surface).toHaveAttribute('data-image-state', 'ready');
    expect(surface).toHaveAttribute('data-image-reveal', 'immediate');
    first.unmount();
    const second = render(<RemoteImage src="departed-during-resize.png" intrinsic />);
    expect(second.container.firstChild).toHaveStyle({ aspectRatio: '0.8' });
    load(second.container, 400, 1000);
    expect(second.container.firstChild).toHaveStyle({ aspectRatio: '0.8' });
  });

  it('retains the rendered ratio when a resizing row unmounts before departure is observed', () => {
    const first = render(<RemoteImage src="unmounted-during-resize.png" intrinsic />);
    const surface = first.container.firstChild as HTMLElement;
    paint();
    load(first.container, 400, 1000);
    expect(surface).toHaveAttribute('data-image-state', 'resizing');
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 500,
      top: 0,
      bottom: 500,
      left: 0,
      right: 400,
    } as DOMRect);
    first.unmount();
    const second = render(<RemoteImage src="unmounted-during-resize.png" intrinsic />);
    expect(second.container.firstChild).toHaveStyle({ aspectRatio: '0.8' });
    load(second.container, 400, 1000);
    expect(second.container.firstChild).toHaveStyle({ aspectRatio: '0.8' });
    expect(second.container.firstChild).toHaveAttribute('data-image-state', 'ready');
    expect(second.container.firstChild).toHaveAttribute('data-image-reveal', 'immediate');
  });

  it('settles a synchronous decoded portrait cache hit before paint in Strict Mode', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(1000);
    const { container } = render(
      <StrictMode>
        <RemoteImage src="strict-cached-portrait.png" intrinsic />
      </StrictMode>
    );
    expect(container.firstChild).toHaveStyle({ aspectRatio: '0.4' });
    expect(container.firstChild).toHaveAttribute('data-image-state', 'ready');
    expect(container.firstChild).toHaveAttribute('data-image-reveal', 'immediate');
    paint();
    expect(container.firstChild).toHaveAttribute('data-image-state', 'ready');
    expect(container.firstChild).toHaveAttribute('data-image-reveal', 'immediate');
  });

  it('freezes a departed row against a late result and retains the same ratio on remount', () => {
    const first = render(<RemoteImage src="late.png" intrinsic />);
    paint();
    visible = false;
    act(() => visibilityChanged());
    load(first.container, 400, 1000);
    expect(first.container.firstChild).toHaveStyle({ aspectRatio: String(4 / 3) });
    first.unmount();
    const second = render(<RemoteImage src="late.png" intrinsic />);
    expect(second.container.firstChild).toHaveStyle({ aspectRatio: String(4 / 3) });
  });

  it('preserves authoritative metadata when loaded thumbnail dimensions differ', () => {
    const { container } = render(<RemoteImage src="metadata.png" intrinsic aspectRatio={0.6} />);
    paint();
    load(container, 800, 600);
    expect(container.firstChild).toHaveStyle({ aspectRatio: '0.6' });
    expect(container.firstChild).toHaveAttribute('data-image-state', 'revealing');
  });

  it('settles size and appearance immediately with reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { container } = render(<RemoteImage src="reduce-motion.png" intrinsic />);
    paint();
    load(container, 400, 1000);
    expect(container.firstChild).toHaveStyle({ aspectRatio: '0.4' });
    expect(container.firstChild).toHaveAttribute('data-image-state', 'ready');
    expect(container.firstChild).toHaveAttribute('data-image-reveal', 'immediate');
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });

  it('retries the full failure surface without bubbling into preview, then crossfades recovery', () => {
    const preview = vi.fn();
    const { container } = render(
      <div onClick={preview}>
        <RemoteImage src="retry.png" allowsRetry intrinsic />
      </div>
    );
    const surface = container.querySelector('.remote-image');
    fireEvent.error(container.querySelector('img')!);
    const retry = screen.getByRole('button', { name: 'retry' });
    expect(retry).toHaveClass('remote-image__failure');
    fireEvent.click(retry);
    expect(preview).not.toHaveBeenCalled();
    expect(surface).toHaveAttribute('data-image-state', 'loading');
    paint();
    load(container, 400, 1000);
    expect(surface).toHaveAttribute('data-image-state', 'revealing');
    expect(surface).toHaveStyle({ aspectRatio: String(4 / 3) });
    fireEvent.click(container.querySelector('img')!);
    expect(preview).toHaveBeenCalledOnce();
  });

  it('keeps enclosing link navigation available for fixed thumbnails without retry', () => {
    const navigate = vi.fn();
    const { container } = render(
      <div onClick={navigate}>
        <RemoteImage src="link.png" />
      </div>
    );
    fireEvent.error(container.querySelector('img')!);
    fireEvent.click(screen.getByRole('img', { name: 'unavailable' }));
    expect(navigate).toHaveBeenCalledOnce();
  });
});
