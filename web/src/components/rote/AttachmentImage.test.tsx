import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AttachmentImage } from './AttachmentImage';

describe('AttachmentImage', () => {
  it('renders a placeholder without creating an img when src is empty', () => {
    const { container } = render(<AttachmentImage src="" alt="" />);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'imageUnavailable' })).toBeVisible();
  });

  it('replaces a failed img with the placeholder', () => {
    const { container } = render(
      <AttachmentImage src="https://cdn.example.com/missing.jpg" alt="" />
    );
    const image = container.querySelector('img');
    expect(image).toBeInTheDocument();

    fireEvent.error(image!);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'imageUnavailable' })).toBeVisible();
  });
});
