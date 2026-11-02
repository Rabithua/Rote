import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminHookChannel } from '../types';
import HookChannelDialog from './HookChannelDialog';

vi.unmock('react-dom/client');

const channel: AdminHookChannel = {
  id: 'admin-channel',
  name: 'Saved channel',
  enabled: true,
  type: 'admin_pwa',
  events: ['user.registered'],
};

function DialogPage({
  channel: currentChannel = channel,
  isSaving = false,
  mode = 'edit',
  onDirtyChange,
  onSubmit = async () => true,
}: {
  channel?: AdminHookChannel | null;
  isSaving?: boolean;
  mode?: 'create' | 'edit';
  onDirtyChange: (dirty: boolean) => void;
  onSubmit?: (channel: AdminHookChannel) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(true);
  return (
    <HookChannelDialog
      channel={currentChannel || undefined}
      isSaving={isSaving}
      mode={mode}
      onOpenChange={setOpen}
      onDirtyChange={onDirtyChange}
      onSubmit={onSubmit}
      open={open}
    />
  );
}

function editName(value = 'Edited channel') {
  fireEvent.change(screen.getByLabelText('hooks.channelName'), { target: { value } });
}

describe('notification hook channel draft protection', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reports only actual edits and clears its report on unmount', () => {
    const onDirtyChange = vi.fn();
    const { unmount } = render(<DialogPage onDirtyChange={onDirtyChange} />);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    editName();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    editName('Saved channel');
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    editName();
    unmount();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('confirms cancellation, keeps edits when continued, and discards only on confirmation', async () => {
    const onDirtyChange = vi.fn();
    render(<DialogPage onDirtyChange={onDirtyChange} />);
    editName();
    fireEvent.click(screen.getByRole('button', { name: 'hooks.dialog.cancel' }));
    expect(screen.getByText('title')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'continueEditing' }));
    await waitFor(() => expect(screen.queryByText('continueEditing')).not.toBeInTheDocument());
    expect(screen.getByLabelText('hooks.channelName')).toHaveValue('Edited channel');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'hooks.dialog.cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'discardAndLeave' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('confirms Escape on a dirty editor and lets Escape dismiss the confirmation', async () => {
    const onDirtyChange = vi.fn();
    render(<DialogPage onDirtyChange={onDirtyChange} />);
    editName();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    expect(await screen.findByRole('button', { name: 'continueEditing' })).toBeVisible();
    fireEvent.keyDown(screen.getByRole('button', { name: 'continueEditing' }), {
      key: 'Escape',
      code: 'Escape',
    });
    await waitFor(() => expect(screen.queryByText('continueEditing')).not.toBeInTheDocument());
    expect(screen.getByLabelText('hooks.channelName')).toHaveValue('Edited channel');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it.each([false, true])('clears dirty only on successful submit (success: %s)', async (saved) => {
    const onDirtyChange = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(saved);
    render(<DialogPage onDirtyChange={onDirtyChange} onSubmit={onSubmit} />);
    editName();
    fireEvent.submit(
      screen.getByRole('button', { name: 'hooks.dialog.applyAction' }).closest('form')!
    );
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ ...channel, name: 'Edited channel' })
    );
    if (saved) {
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    } else {
      expect(screen.getByLabelText('hooks.channelName')).toHaveValue('Edited channel');
      expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    }
  });

  it('preserves local edits across server updates and channel removal', () => {
    const onDirtyChange = vi.fn();
    const view = render(<DialogPage onDirtyChange={onDirtyChange} />);
    editName();
    view.rerender(
      <DialogPage channel={{ ...channel, name: 'Remote name' }} onDirtyChange={onDirtyChange} />
    );
    expect(screen.getByLabelText('hooks.channelName')).toHaveValue('Edited channel');
    view.rerender(<DialogPage channel={null} onDirtyChange={onDirtyChange} />);
    expect(screen.getByLabelText('hooks.channelName')).toHaveValue('Edited channel');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it('keeps a new channel ID stable while editing and rerendering', () => {
    const onDirtyChange = vi.fn();
    const view = render(<DialogPage channel={null} mode="create" onDirtyChange={onDirtyChange} />);
    const inputId = screen.getByLabelText('hooks.channelName').id;
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    editName('New channel');
    view.rerender(<DialogPage channel={null} mode="create" onDirtyChange={onDirtyChange} />);
    expect(screen.getByLabelText('hooks.channelName')).toHaveAttribute('id', inputId);
    expect(screen.getByLabelText('hooks.channelName')).toHaveValue('New channel');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it('prevents discarding a dirty editor while a save is pending', async () => {
    const onDirtyChange = vi.fn();
    const view = render(<DialogPage onDirtyChange={onDirtyChange} />);
    editName();
    fireEvent.click(screen.getByRole('button', { name: 'hooks.dialog.cancel' }));
    view.rerender(<DialogPage isSaving onDirtyChange={onDirtyChange} />);
    expect(screen.getByRole('button', { name: 'discardAndLeave' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'discardAndLeave' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'continueEditing' }));
    await waitFor(() => expect(screen.queryByText('continueEditing')).not.toBeInTheDocument());
    expect(screen.getByLabelText('hooks.channelName')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'hooks.dialog.cancel' })).toBeDisabled();
  });
});
