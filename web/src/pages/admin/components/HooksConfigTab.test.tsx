import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SystemConfig } from '../types';
import HooksConfigTab from './HooksConfigTab';

const { onMutate, post, put, translate } = vi.hoisted(() => ({
  onMutate: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  translate: (key: string) => key,
}));

vi.mock('@/utils/api', () => ({ post, put }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: translate }) }));
vi.unmock('react-dom/client');

const initialConfig: NonNullable<SystemConfig['notification']> = {
  vapidPrivateKey: 'private-key',
  vapidPublicKey: 'public-key',
  adminHooks: {
    enabled: true,
    channels: [
      {
        id: 'admin-pwa',
        name: 'Existing channel',
        enabled: true,
        events: ['user.registered', 'note.public.created'],
        type: 'admin_pwa',
      },
    ],
  },
};

function HooksPage() {
  const [notificationConfig, setNotificationConfig] = useState<
    SystemConfig['notification'] | undefined
  >(initialConfig);
  const [isSaving, setIsSaving] = useState(false);

  return (
    <HooksConfigTab
      isSaving={isSaving}
      notificationConfig={notificationConfig}
      onMutate={onMutate}
      setIsSaving={setIsSaving}
      setNotificationConfig={setNotificationConfig}
    />
  );
}

describe('notification hook immediate saving', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    put.mockReset();
    put.mockResolvedValue({});
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      }
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('saves the master switch immediately and prevents overlapping changes while pending', async () => {
    let resolve!: (value: object) => void;
    put.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    render(<HooksPage />);

    expect(screen.queryByRole('button', { name: 'save' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch'));

    expect(put).toHaveBeenCalledExactlyOnceWith('/admin/settings', {
      group: 'notification',
      config: {
        ...initialConfig,
        adminHooks: { ...initialConfig.adminHooks, enabled: false },
      },
    });
    expect(screen.getByRole('switch')).toBeDisabled();
    for (const name of ['hooks.add', 'hooks.configure', 'hooks.remove', 'hooks.test']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }

    await act(async () => resolve({}));

    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(screen.getByRole('switch')).toBeEnabled();
    expect(onMutate).toHaveBeenCalledOnce();
  });

  it('keeps the saved master switch state when persistence fails', async () => {
    put.mockRejectedValueOnce(new Error('Save rejected'));
    render(<HooksPage />);

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('saveFailed'));
    expect(screen.getByRole('switch')).toBeChecked();
    expect(screen.getByRole('switch')).toBeEnabled();
    expect(onMutate).not.toHaveBeenCalled();
  });

  it('retains a channel after failed deletion and removes it when deletion is saved', async () => {
    put.mockRejectedValueOnce(new Error('Save rejected'));
    render(<HooksPage />);

    fireEvent.click(screen.getByRole('button', { name: 'hooks.remove' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('saveFailed'));
    expect(screen.getByText('Existing channel')).toBeVisible();
    expect(onMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'hooks.remove' }));

    await waitFor(() => expect(screen.queryByText('Existing channel')).not.toBeInTheDocument());
    expect(screen.getByText('hooks.empty')).toBeVisible();
    expect(put).toHaveBeenLastCalledWith('/admin/settings', {
      group: 'notification',
      config: { ...initialConfig, adminHooks: { enabled: true, channels: [] } },
    });
  });

  it('persists a new channel when its form is submitted without another page save', async () => {
    render(<HooksPage />);
    fireEvent.click(screen.getByRole('button', { name: 'hooks.add' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('hooks.channelName'), {
      target: { value: 'New Bark channel' },
    });
    fireEvent.change(within(dialog).getByLabelText('hooks.bark.key'), {
      target: { value: 'device-key' },
    });
    fireEvent.submit(
      within(dialog).getByRole('button', { name: 'hooks.dialog.addAction' }).closest('form')!
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('New Bark channel')).toBeVisible();
    expect(put).toHaveBeenCalledExactlyOnceWith('/admin/settings', {
      group: 'notification',
      config: {
        ...initialConfig,
        adminHooks: {
          enabled: true,
          channels: [
            initialConfig.adminHooks!.channels[0],
            expect.objectContaining({
              name: 'New Bark channel',
              key: 'device-key',
              type: 'bark',
              enabled: true,
              events: ['user.registered', 'note.public.created'],
            }),
          ],
        },
      },
    });
    expect(screen.queryByRole('button', { name: 'save' })).not.toBeInTheDocument();
  });

  it('keeps an edited channel draft after a failed save and closes only after a successful retry', async () => {
    let reject!: (error: Error) => void;
    put.mockReturnValueOnce(new Promise((_, fail) => (reject = fail)));
    render(<HooksPage />);
    fireEvent.click(screen.getByRole('button', { name: 'hooks.configure' }));
    const dialog = screen.getByRole('dialog');
    const nameInput = within(dialog).getByLabelText('hooks.channelName');
    fireEvent.change(nameInput, { target: { value: 'Updated channel' } });
    fireEvent.submit(
      within(dialog).getByRole('button', { name: 'hooks.dialog.applyAction' }).closest('form')!
    );

    expect(nameInput).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'hooks.dialog.cancel' })).toBeDisabled();
    await act(async () => reject(new Error('Save rejected')));

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(nameInput).toHaveValue('Updated channel');
    expect(nameInput).toBeEnabled();
    expect(toast.error).toHaveBeenCalledWith('saveFailed');
    expect(onMutate).not.toHaveBeenCalled();

    fireEvent.submit(
      within(dialog).getByRole('button', { name: 'hooks.dialog.applyAction' }).closest('form')!
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Updated channel')).toBeVisible();
    expect(screen.queryByText('Existing channel')).not.toBeInTheDocument();
    expect(put).toHaveBeenLastCalledWith('/admin/settings', {
      group: 'notification',
      config: {
        ...initialConfig,
        adminHooks: {
          enabled: true,
          channels: [{ ...initialConfig.adminHooks!.channels[0], name: 'Updated channel' }],
        },
      },
    });
  });
});
