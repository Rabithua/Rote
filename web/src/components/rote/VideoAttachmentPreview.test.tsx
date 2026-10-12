import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VideoAttachmentPreview } from './VideoAttachmentPreview';

describe('VideoAttachmentPreview rail controls', () => {
  it('shows play, duration, and mute state over the shared media frame', () => {
    const onLoadedMetadata = vi.fn();
    const { container } = render(
      <VideoAttachmentPreview
        playbackSrc="/sample.mp4"
        posterSrc="/sample.jpg"
        railOverlay
        onLoadedMetadata={onLoadedMetadata}
      />
    );
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'duration', { value: 18 });
    fireEvent.loadedMetadata(video);

    expect(video).not.toHaveAttribute('controls');
    expect(screen.getByRole('button', { name: 'playVideo' })).toBeVisible();
    expect(screen.getByText('0:18')).toBeVisible();
    expect(onLoadedMetadata).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'unmuteVideo' }));
    expect(screen.getByRole('button', { name: 'muteVideo' })).toBeVisible();
  });
});
