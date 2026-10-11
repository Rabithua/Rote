import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteImage } from './RemoteImage';

describe('RemoteImage presentation', () => {
  let frames: FrameRequestCallback[];
  let visibilityChanged: () => void;
  let visible: boolean;
  const paint = () => {
    for (let i = 0; i < 2; i++) {
      const pending = frames;
      frames = [];
      act(() => pending.forEach((callback) => callback(performance.now())));
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
    frames = [];
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
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
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
