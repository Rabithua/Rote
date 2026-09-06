import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { NoteShareDialog } from './NoteShareDialog';
import { createNoteShare, getNoteShare, revokeNoteShare } from './api';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  createNoteShare: vi.fn(),
  getNoteShare: vi.fn(),
  revokeNoteShare: vi.fn(),
}));

const activeShare = { token: 'a'.repeat(43), createdAt: '2026-09-06T12:00:00Z' };
const writeText = vi.fn();

describe('anonymous share management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    writeText.mockResolvedValue(undefined);
    vi.mocked(getNoteShare).mockResolvedValue(null);
    vi.mocked(createNoteShare).mockResolvedValue(activeShare);
    vi.mocked(revokeNoteShare).mockResolvedValue(undefined);
  });

  it('only creates a link after the author clicks, then copies and reuses it', async () => {
    render(<NoteShareDialog noteId="note-1" isPublic={false} onClose={vi.fn()} />);
    const create = await screen.findByRole('button', { name: 'createAndCopy' });
    expect(createNoteShare).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
    fireEvent.click(create);
    const copy = await screen.findByRole('button', { name: 'copy' });
    await waitFor(() => expect(copy).toBeEnabled());
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/${activeShare.token}`);
    expect(screen.getByLabelText('linkLabel')).toHaveValue(
      `${window.location.origin}/s/${activeShare.token}`
    );
    fireEvent.click(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(createNoteShare).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('copied');
  });

  it('keeps the link available for manual copying when clipboard permission is denied', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    render(<NoteShareDialog noteId="note-1" isPublic={false} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'createAndCopy' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('copyFailed'));
    expect(screen.getByLabelText('linkLabel')).toHaveValue(
      `${window.location.origin}/s/${activeShare.token}`
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('preserves current share state after failed revocation and clears it after success', async () => {
    vi.mocked(getNoteShare).mockResolvedValue(activeShare);
    vi.mocked(revokeNoteShare).mockRejectedValueOnce(new Error('offline'));
    render(<NoteShareDialog noteId="note-1" isPublic onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'stop' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('stopFailed'));
    expect(screen.getByLabelText('linkLabel')).toBeInTheDocument();
    expect(screen.getByText('publicNotice')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'stop' }));
    expect(await screen.findByRole('button', { name: 'createAndCopy' })).toBeInTheDocument();
    expect(screen.queryByLabelText('linkLabel')).not.toBeInTheDocument();
    expect(createNoteShare).not.toHaveBeenCalled();
  });

  it('provides retry on load failure and keeps creation failures recoverable', async () => {
    vi.mocked(getNoteShare).mockRejectedValueOnce(new Error('offline'));
    vi.mocked(createNoteShare).mockRejectedValueOnce(new Error('offline'));
    render(<NoteShareDialog noteId="note-1" isPublic={false} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'retry' }));
    fireEvent.click(await screen.findByRole('button', { name: 'createAndCopy' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('createFailed'));
    expect(screen.getByRole('button', { name: 'createAndCopy' })).toBeEnabled();
    expect(writeText).not.toHaveBeenCalled();
  });
});
