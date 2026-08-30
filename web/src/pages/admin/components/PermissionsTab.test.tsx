import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PermissionsTab from './PermissionsTab';

const { mutate, put, useSWR } = vi.hoisted(() => ({
  mutate: vi.fn(),
  put: vi.fn(),
  useSWR: vi.fn(),
}));

vi.mock('swr', () => ({ default: useSWR }));
vi.mock('@/utils/api', () => ({ get: vi.fn(), put }));
vi.mock('@/state/profile', () => ({
  useProfile: () => ({ role: 'super_admin' }),
}));
vi.mock('./PermissionSettingRow', () => ({
  default: ({
    capability,
    value,
    options,
    effective,
  }: {
    capability: string;
    value: string;
    options: readonly string[];
    effective?: { allowed: boolean };
  }) => (
    <div data-testid={`permission-${capability}`} data-options={options.join(',')}>
      <span>{value}</span>
      <span>{effective?.allowed ? 'effective.allowed' : 'effective.denied'}</span>
    </div>
  ),
}));

const capabilities = {
  'attachment.upload': 'allow',
  'attachment.video.upload': 'deny',
  'ai.chat': 'deny',
  'resource.storage.unlimited': 'inherit',
} as const;

const effective = {
  'attachment.upload': { allowed: true, source: 'role_policy', role: 'user' },
  'attachment.video.upload': { allowed: false, source: 'role_policy', role: 'user' },
  'ai.chat': { allowed: false, source: 'role_policy', role: 'user' },
  'resource.storage.unlimited': { allowed: false, source: 'role_default', role: 'user' },
} as const;

const policies = ['user', 'moderator', 'admin'].map((role) => ({
  role,
  capabilities,
  effective: Object.fromEntries(
    Object.entries(effective).map(([key, capability]) => [key, { ...capability, role }])
  ),
}));

describe('PermissionsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutate.mockResolvedValue(undefined);
    put.mockResolvedValue({});
    useSWR.mockReturnValue({ data: policies, isLoading: false, mutate });
  });

  it('shows inherited unlimited storage with its effective state and preserves it on save', async () => {
    render(<PermissionsTab />);

    const userSection = screen.getByText('roles.user.label').closest('section');
    expect(userSection).not.toBeNull();
    const row = within(userSection as HTMLElement).getByTestId(
      'permission-resource.storage.unlimited'
    );
    expect(row).toHaveAttribute('data-options', 'inherit,allow,deny');
    expect(within(row).getByText('inherit')).toBeVisible();
    expect(within(row).getByText('effective.denied')).toBeVisible();

    fireEvent.click(within(userSection as HTMLElement).getByRole('button', { name: 'saveRole' }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/admin/permissions/roles/user', { capabilities })
    );
  });
});
