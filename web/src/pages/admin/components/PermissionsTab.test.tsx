import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
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
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { role: string }) =>
      key === 'saveRoleFor' ? `${key}:${options?.role}` : key,
  }),
}));
vi.mock('./PermissionSettingRow', () => ({
  default: ({
    capability,
    value,
    options,
    effective,
    onChange,
  }: {
    capability: string;
    value: string;
    options: readonly string[];
    effective?: { allowed: boolean };
    onChange: (value: string) => void;
  }) => (
    <div data-testid={`permission-${capability}`} data-options={options.join(',')}>
      <select
        aria-label={capability}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <span>{effective?.allowed ? 'effective.allowed' : 'effective.denied'}</span>
    </div>
  ),
}));
vi.unmock('react-dom/client');

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

function roleSection(role: string) {
  return within(screen.getByText(`roles.${role}.label`).closest('section') as HTMLElement);
}

function changeCapability(role: string, value: string) {
  fireEvent.change(roleSection(role).getByLabelText('attachment.upload'), {
    target: { value },
  });
}

function saveRole(role: string) {
  fireEvent.click(screen.getByRole('button', { name: `saveRoleFor:roles.${role}.label` }));
}

describe('PermissionsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutate.mockResolvedValue(undefined);
    put.mockResolvedValue({ data: policies });
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

    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'saveRoleFor:roles.user.label' })).toBeDisabled();
    changeCapability('user', 'deny');
    expect(
      screen.getByRole('button', { name: 'saveRoleFor:roles.moderator.label' })
    ).toBeDisabled();
    saveRole('user');

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/admin/permissions/roles/user', {
        capabilities: { ...capabilities, 'attachment.upload': 'deny' },
      })
    );
  });

  it('reports edits and clears the dirty state when a change is reverted', () => {
    const onDirtyChange = vi.fn();
    render(<PermissionsTab onDirtyChange={onDirtyChange} />);

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    changeCapability('user', 'deny');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    changeCapability('user', 'allow');
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('preserves edited roles when SWR refreshes and updates clean roles', () => {
    const onDirtyChange = vi.fn();
    const { rerender } = render(<PermissionsTab onDirtyChange={onDirtyChange} />);
    changeCapability('user', 'deny');

    const refreshed = policies.map((policy) => ({
      ...policy,
      capabilities: { ...policy.capabilities, 'attachment.upload': 'inherit' },
    }));
    useSWR.mockReturnValue({ data: refreshed, isLoading: false, mutate });
    rerender(<PermissionsTab onDirtyChange={onDirtyChange} />);

    expect(roleSection('user').getByLabelText('attachment.upload')).toHaveValue('deny');
    expect(roleSection('moderator').getByLabelText('attachment.upload')).toHaveValue('inherit');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it('saves one role without clearing another role draft', async () => {
    const onDirtyChange = vi.fn();
    render(<PermissionsTab onDirtyChange={onDirtyChange} />);
    changeCapability('user', 'deny');
    changeCapability('moderator', 'deny');
    saveRole('user');

    await waitFor(() => expect(mutate).toHaveBeenCalledOnce());
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(roleSection('moderator').getByLabelText('attachment.upload')).toHaveValue('deny');
    changeCapability('moderator', 'allow');
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('preserves edits made to a role while its save is pending', async () => {
    let finishSave!: (value: { data: typeof policies }) => void;
    put.mockReturnValueOnce(
      new Promise((resolve) => {
        finishSave = resolve;
      })
    );
    const onDirtyChange = vi.fn();
    const onSavingChange = vi.fn();
    render(<PermissionsTab onDirtyChange={onDirtyChange} onSavingChange={onSavingChange} />);
    changeCapability('user', 'deny');
    saveRole('user');
    expect(onSavingChange).toHaveBeenLastCalledWith(true);
    changeCapability('user', 'inherit');

    await act(async () => finishSave({ data: policies }));
    expect(onSavingChange).toHaveBeenLastCalledWith(false);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(roleSection('user').getByLabelText('attachment.upload')).toHaveValue('inherit');
    expect(put).toHaveBeenCalledWith('/admin/permissions/roles/user', {
      capabilities: { ...capabilities, 'attachment.upload': 'deny' },
    });

    changeCapability('user', 'deny');
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('keeps failed saves dirty and clears reported state on unmount', async () => {
    put.mockRejectedValueOnce(new Error('save rejected'));
    const onDirtyChange = vi.fn();
    const onSavingChange = vi.fn();
    const { unmount } = render(
      <PermissionsTab onDirtyChange={onDirtyChange} onSavingChange={onSavingChange} />
    );
    changeCapability('user', 'deny');
    saveRole('user');

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(onSavingChange).toHaveBeenLastCalledWith(false);
    expect(mutate).not.toHaveBeenCalled();
    unmount();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(onSavingChange).toHaveBeenLastCalledWith(false);
  });
});
