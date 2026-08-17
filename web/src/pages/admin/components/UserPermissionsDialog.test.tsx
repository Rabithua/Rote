import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserPermissionsDialog from './UserPermissionsDialog';

const { mutate, put, useSWR } = vi.hoisted(() => ({
  mutate: vi.fn(),
  put: vi.fn(),
  useSWR: vi.fn(),
}));

vi.mock('swr', () => ({ default: useSWR }));
vi.mock('@/utils/api', () => ({ get: vi.fn(), put }));

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
    put.mockResolvedValue({});
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

    fireEvent.click(screen.getByRole('button', { name: 'userDialog.save' }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/admin/permissions/users/user-1', {
        capabilities: permissions.overrides,
      })
    );
  });
});
