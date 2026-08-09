import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentPhotoPreview } from './AttachmentPhotoPreview';

vi.mock('react-photo-view', () => ({
  PhotoView: ({ children, src }: { children: React.ReactElement; src: string }) => (
    <div data-testid="photo-view" data-src={src}>
      {children}
    </div>
  ),
}));

describe('AttachmentPhotoPreview', () => {
  it('removes the invalid PhotoView target after its image fails to load', () => {
    const { container } = render(
      <AttachmentPhotoPreview
        alt=""
        containerClassName="preview"
        imageClassName="image"
        previewSrc="https://cdn.example.com/missing.jpg"
        src="https://cdn.example.com/missing.jpg"
      />
    );

    expect(screen.getByTestId('photo-view')).toBeInTheDocument();
    fireEvent.error(container.querySelector('img')!);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'imageUnavailable' })).toBeVisible();
    expect(screen.queryByTestId('photo-view')).not.toBeInTheDocument();
  });
});
