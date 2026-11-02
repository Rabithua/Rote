import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserPermissionsDialog from './UserPermissionsDialog';

const { mutate, put, useSWR } = vi.hoisted(() => ({
  mutate: vi.fn(),
  put: vi.fn(),
  useSWR: vi.fn(),
}));

vi.mock('swr', () => ({ default: useSWR }));
vi.mock('@/utils/api', () => ({ get: vi.fn(), put }));
vi.unmock('react-dom/client');
vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    disabled: boolean;
    children: ReactNode;
  }) => (
    <select
      aria-label="permission"
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => children,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));
const user = { id: 'user-1', username: 'alice', role: 'user' };
function editPermission() {
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'deny' } });
}

const permissions = {
  role: 'user',
  capabilities: {
    'attachment.upload': { allowed: true, source: 'role_default', role: 'user' },
    'attachment.video.upload': { allowed: false, source: 'role_default', role: 'user' },
    'ai.chat': { allowed: false, source: 'role_default', role: 'user' },
    'resource.storage.unlimited': { allowed: true, source: 'user_override', role: 'user' },
  },
  overrides: {
    'attachment.upload': 'inherit',
    'attachment.video.upload': 'inherit',
    'ai.chat': 'inherit',
    'resource.storage.unlimited': 'allow',
  },
} as const;

describe('UserPermissionsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutate.mockResolvedValue(undefined);
    put.mockReset().mockResolvedValue({ data: permissions });
    useSWR.mockReturnValue({ data: permissions, isLoading: false, mutate });
  });

  it('loads the unlimited storage row and shows its effective state', () => {
    render(
      <UserPermissionsDialog
        user={{ id: 'user-1', username: 'alice', role: 'user' }}
        onClose={vi.fn()}
        canManage
      />
    );

    const label = screen.getByText('capabilities.resource.storage.unlimited.label');
    const row = label.closest('[data-slot="dialog-content"]')
      ? label.parentElement?.parentElement?.parentElement
      : null;
    expect(row).not.toBeNull();
    expect(
      within(row as HTMLElement).getByText('capabilities.resource.storage.unlimited.description')
    ).toBeVisible();
    expect(within(row as HTMLElement).getByText('effective.allowed')).toBeVisible();
  });

  it('saves the unlimited storage override through the existing user permissions endpoint', async () => {
    render(
      <UserPermissionsDialog
        user={{ id: 'user-1', username: 'alice', role: 'user' }}
        onClose={vi.fn()}
        canManage
      />
    );

    expect(screen.getByRole('button', { name: 'userDialog.save' })).toBeDisabled();
    fireEvent.change(screen.getAllByRole('combobox')[3], { target: { value: 'deny' } });
    fireEvent.click(screen.getByRole('button', { name: 'userDialog.save' }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/admin/permissions/users/user-1', {
        capabilities: { ...permissions.overrides, 'resource.storage.unlimited': 'deny' },
      })
    );
  });
  it.each(['footer', 'close', 'escape'] as const)(
    'guards %s closure and retains edits when continuing',
    (entry) => {
      const onClose = vi.fn();
      const onDirtyChange = vi.fn();
      render(
        <UserPermissionsDialog
          user={user}
          onClose={onClose}
          onDirtyChange={onDirtyChange}
          canManage
        />
      );
      editPermission();
      expect(onDirtyChange).toHaveBeenLastCalledWith(true);
      if (entry === 'escape') fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      else {
        const buttons = screen.getAllByRole('button', { name: 'userDialog.close' });
        fireEvent.click(buttons[entry === 'footer' ? 0 : buttons.length - 1]);
      }
      expect(screen.getByRole('button', { name: 'continueEditing' })).toBeVisible();
      expect(onClose).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'continueEditing' }));
      expect(screen.getAllByRole('combobox')[0]).toHaveValue('deny');
      fireEvent.click(screen.getAllByRole('button', { name: 'userDialog.close' })[0]);
      fireEvent.click(screen.getByRole('button', { name: 'discardAndLeave' }));
      expect(onClose).toHaveBeenCalledOnce();
      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    }
  );

  it('guards clicking the overlay', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      render(<UserPermissionsDialog user={user} onClose={onClose} canManage />);
      editPermission();
      act(() => vi.advanceTimersByTime(0));
      fireEvent.pointerDown(document.querySelector('[data-slot="dialog-overlay"]')!, {
        pointerType: 'mouse',
        button: 0,
      });
      expect(screen.getByRole('button', { name: 'continueEditing' })).toBeVisible();
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a dirty draft when SWR refreshes', () => {
    const { rerender } = render(<UserPermissionsDialog user={user} onClose={vi.fn()} canManage />);
    editPermission();
    useSWR.mockReturnValue({
      data: { ...permissions, overrides: { ...permissions.overrides, 'ai.chat': 'allow' } },
      isLoading: false,
      mutate,
    });
    rerender(<UserPermissionsDialog user={user} onClose={vi.fn()} canManage />);
    expect(screen.getAllByRole('combobox')[0]).toHaveValue('deny');
    expect(screen.getAllByRole('combobox')[2]).toHaveValue('inherit');
  });

  it('blocks editing and all closing while saving, then closes on success', async () => {
    let finish!: (response: { data: typeof permissions }) => void;
    put.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const onClose = vi.fn();
    const onSavingChange = vi.fn();
    render(
      <UserPermissionsDialog
        user={user}
        onClose={onClose}
        onSavingChange={onSavingChange}
        canManage
      />
    );
    editPermission();
    fireEvent.click(screen.getByRole('button', { name: 'userDialog.save' }));
    expect(onSavingChange).toHaveBeenLastCalledWith(true);
    screen.getAllByRole('combobox').forEach((select) => expect(select).toBeDisabled());
    expect(screen.getByRole('button', { name: 'userDialog.close' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'continueEditing' })).not.toBeInTheDocument();
    await act(async () => finish({ data: permissions }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSavingChange).toHaveBeenLastCalledWith(false);
  });

  it('preserves rejected saves and starts a fresh session for each user', async () => {
    put.mockRejectedValueOnce(new Error('offline'));
    const onClose = vi.fn();
    const onDirtyChange = vi.fn();
    const { rerender, unmount } = render(
      <UserPermissionsDialog
        user={user}
        onClose={onClose}
        onDirtyChange={onDirtyChange}
        canManage
      />
    );
    editPermission();
    fireEvent.click(screen.getByRole('button', { name: 'userDialog.save' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'userDialog.save' })).toBeEnabled()
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('alert')).toHaveTextContent('userDialog.saveFailed');
    expect(screen.getAllByRole('combobox')[0]).toHaveValue('deny');
    rerender(
      <UserPermissionsDialog
        user={{ ...user, id: 'user-2' }}
        onClose={onClose}
        onDirtyChange={onDirtyChange}
        canManage
      />
    );
    expect(screen.getAllByRole('combobox')[0]).toHaveValue('inherit');
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    editPermission();
    unmount();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('keeps ordinary administrators read-only', () => {
    render(<UserPermissionsDialog user={user} onClose={vi.fn()} canManage={false} />);
    expect(screen.getByText('readOnlyDescription')).toBeVisible();
    screen.getAllByRole('combobox').forEach((select) => expect(select).toBeDisabled());
    expect(screen.queryByRole('button', { name: 'userDialog.save' })).not.toBeInTheDocument();
  });
});
