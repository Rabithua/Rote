import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ImportSourceForm from './ImportSourceForm';

describe('ImportSourceForm', () => {
  it('starts with a four-platform logo grid', () => {
    const { container } = renderForm();

    expect(screen.getByText('sources.rote')).toBeInTheDocument();
    expect(screen.getByText('sources.memos')).toBeInTheDocument();
    expect(screen.getByText('sources.flomo')).toBeInTheDocument();
    expect(screen.getByText('sources.weread')).toBeInTheDocument();
    expect(container.querySelectorAll('button')).toHaveLength(4);
    expect(container.querySelectorAll('img')).toHaveLength(4);
  });

  it('opens platform configuration in a dialog', () => {
    renderForm();

    fireEvent.click(screen.getByText('sources.weread').closest('button')!);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'sources.weread' })).toBeInTheDocument();
    expect(screen.getByText('modes.file')).toBeInTheDocument();
    expect(screen.getByText('modes.api')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'modes.api' }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByLabelText('wereadApiKey')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('sources.rote')).toBeInTheDocument();
  });
});

function renderForm() {
  return render(<ImportSourceForm onPrepared={vi.fn()} onError={vi.fn()} />);
}
