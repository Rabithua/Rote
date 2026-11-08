import {
  CAPABILITY_KEYS,
  type CapabilityKey,
  type UserCapabilityPermissions,
} from '@/types/permissions';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserPermissionsDialog from './UserPermissionsDialog';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

vi.mock('@/utils/api', () => ({ get, put }));
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
const storageKey = 'resource.storage.unlimited';

const permissions: UserCapabilityPermissions = {
  role: 'user',
  capabilities: {
    'attachment.upload': { allowed: true, source: 'role_default', role: 'user' },
    'attachment.video.upload': { allowed: false, source: 'role_default', role: 'user' },
    'ai.chat': { allowed: false, source: 'role_default', role: 'user' },
    [storageKey]: { allowed: true, source: 'user_override', role: 'user' },
  },
  overrides: {
    'attachment.upload': 'inherit',
    'attachment.video.upload': 'inherit',
    'ai.chat': 'inherit',
    [storageKey]: 'allow',
  },
};

const savedPermissions: UserCapabilityPermissions = {
  ...permissions,
  capabilities: {
    ...permissions.capabilities,
    [storageKey]: { allowed: false, source: 'role_default', role: 'user' },
  },
  overrides: { ...permissions.overrides, [storageKey]: 'inherit' },
};

function permissionSelect(capability: CapabilityKey) {
  return screen.getAllByRole('combobox')[CAPABILITY_KEYS.indexOf(capability)];
}

function renderDialog({
  canManage = true,
  onClose = vi.fn(),
  onSavingChange,
}: {
  canManage?: boolean;
  onClose?: () => void;
  onSavingChange?: (saving: boolean) => void;
} = {}) {
  const dialog = (selectedUser: typeof user) => (
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <UserPermissionsDialog
        user={selectedUser}
        onClose={onClose}
        onSavingChange={onSavingChange}
        canManage={canManage}
      />
    </SWRConfig>
  );
  const view = render(dialog(user));
  return { selectUser: (selectedUser: typeof user) => view.rerender(dialog(selectedUser)) };
}

describe('UserPermissionsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockReset().mockResolvedValue({ data: permissions });
    put.mockReset().mockResolvedValue({ data: savedPermissions });
  });

  it('autosaves only the changed override and keeps the dialog open with effective values', async () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    await screen.findAllByRole('combobox');
    const storage = permissionSelect(storageKey);
    const storageRow = within(storage.parentElement as HTMLElement);

    expect(storage).toHaveValue('allow');
    expect(
      storageRow.getByText('capabilities.resource.storage.unlimited.description')
    ).toBeVisible();
    expect(storageRow.getByText('effective.allowed')).toBeVisible();
    expect(permissionSelect('attachment.upload')).toHaveValue('inherit');
    expect(screen.queryByRole('button', { name: 'userDialog.save' })).toBeNull();
    expect(put).not.toHaveBeenCalled();

    fireEvent.change(storage, { target: { value: 'inherit' } });

    expect(put).toHaveBeenCalledExactlyOnceWith('/admin/permissions/users/user-1', {
      capabilities: { [storageKey]: 'inherit' },
    });
    expect(await storageRow.findByText('effective.denied')).toBeVisible();
    expect(storage).toHaveValue('inherit');
    expect(toast.success).toHaveBeenCalledWith('userDialog.saveSuccess');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('blocks edits and dismissal while saving, then enables close when the write finishes', async () => {
    let finishSave!: (response: { data: UserCapabilityPermissions }) => void;
    put.mockReturnValueOnce(
      new Promise((resolve) => {
        finishSave = resolve;
      })
    );
    const onClose = vi.fn();
    const onSavingChange = vi.fn();
    renderDialog({ onClose, onSavingChange });
    await screen.findAllByRole('combobox');
    const storage = permissionSelect(storageKey);
    const overlay = document.querySelector('[data-slot="dialog-overlay"]') as HTMLElement;

    fireEvent.change(storage, { target: { value: 'inherit' } });

    expect(storage).toHaveValue('inherit');
    expect(screen.getByRole('status')).toHaveTextContent('saving');
    expect(onSavingChange).toHaveBeenLastCalledWith(true);
    for (const select of screen.getAllByRole('combobox')) {
      expect(select).toBeDisabled();
    }
    const close = screen.getByRole('button', { name: 'userDialog.close' });
    expect(close).toBeDisabled();
    fireEvent.click(close);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.pointerDown(overlay, { pointerType: 'mouse', button: 0 });
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => finishSave({ data: savedPermissions }));

    expect(onSavingChange).toHaveBeenLastCalledWith(false);
    expect(storage).toBeEnabled();
    expect(close).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(overlay, { pointerType: 'mouse', button: 0 });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('reports a failed save through a toast, restores the last value, and permits reselection', async () => {
    put.mockRejectedValueOnce(new Error('offline'));
    renderDialog();
    await screen.findAllByRole('combobox');
    const storage = permissionSelect(storageKey);

    fireEvent.change(storage, { target: { value: 'inherit' } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('userDialog.saveFailed'));
    expect(storage).toHaveValue('allow');
    expect(storage).toBeEnabled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();

    fireEvent.change(storage, { target: { value: 'inherit' } });

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(put).toHaveBeenCalledTimes(2);
    expect(storage).toHaveValue('inherit');
  });

  it('loads separate permission values for each selected user', async () => {
    get
      .mockResolvedValueOnce({ data: permissions })
      .mockResolvedValueOnce({ data: savedPermissions });
    const { selectUser } = renderDialog();
    await screen.findAllByRole('combobox');
    expect(permissionSelect(storageKey)).toHaveValue('allow');

    selectUser({ ...user, id: 'user-2' });

    await screen.findAllByRole('combobox');
    expect(get).toHaveBeenLastCalledWith('/admin/permissions/users/user-2');
    expect(permissionSelect(storageKey)).toHaveValue('inherit');
    expect(put).not.toHaveBeenCalled();
  });

  it('keeps ordinary administrators read-only', async () => {
    renderDialog({ canManage: false });
    await screen.findAllByRole('combobox');
    expect(screen.getByText('readOnlyDescription')).toBeVisible();
    for (const select of screen.getAllByRole('combobox')) {
      expect(select).toBeDisabled();
    }
    expect(put).not.toHaveBeenCalled();
  });
});
