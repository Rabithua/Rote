import { MANAGEABLE_ROLES, type RoleCapabilityPolicy } from '@/types/permissions';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PermissionsTab from './PermissionsTab';

const { get, put, useProfile } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  useProfile: vi.fn(),
}));

vi.mock('@/utils/api', () => ({ get, put }));
vi.mock('@/state/profile', () => ({ useProfile }));
vi.mock('./PermissionSettingRow', () => ({
  default: ({
    capability,
    value,
    options,
    effective,
    disabled,
    onChange,
  }: {
    capability: string;
    value: string;
    options: readonly string[];
    effective?: { allowed: boolean };
    disabled?: boolean;
    onChange: (value: string) => void;
  }) => (
    <div data-testid={`permission-${capability}`} data-options={options.join(',')}>
      <select
        aria-label={capability}
        value={value}
        disabled={disabled}
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
  'attachment.video.upload': 'allow',
  'ai.chat': 'deny',
  'resource.storage.unlimited': 'inherit',
} as const;

const policies: RoleCapabilityPolicy[] = MANAGEABLE_ROLES.map((role) => ({
  role,
  capabilities,
  effective: {
    'attachment.upload': { allowed: true, source: 'role_policy', role },
    'attachment.video.upload': { allowed: true, source: 'role_policy', role },
    'ai.chat': { allowed: false, source: 'role_policy', role },
    'resource.storage.unlimited': { allowed: false, source: 'role_default', role },
  },
}));

const updatedPolicies: RoleCapabilityPolicy[] = policies.map((policy) =>
  policy.role === 'user'
    ? {
        ...policy,
        capabilities: { ...policy.capabilities, 'attachment.upload': 'deny' },
        effective: {
          ...policy.effective,
          'attachment.upload': { allowed: false, source: 'role_policy', role: 'user' },
          'attachment.video.upload': { allowed: false, source: 'dependency', role: 'user' },
        },
      }
    : policy
);

function roleSection(role: string) {
  return within(screen.getByText(`roles.${role}.label`).closest('section') as HTMLElement);
}

async function renderPermissions(onSavingChange?: (saving: boolean) => void) {
  const result = render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <PermissionsTab onSavingChange={onSavingChange} />
    </SWRConfig>
  );
  await screen.findAllByRole('combobox');
  return result;
}

describe('PermissionsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({ data: policies });
    put.mockResolvedValue({ data: updatedPolicies });
    useProfile.mockReturnValue({ role: 'super_admin' });
  });

  it('autosaves only the selected capability and displays server-calculated permissions', async () => {
    let finishSave!: (value: { data: RoleCapabilityPolicy[] }) => void;
    put.mockReturnValueOnce(
      new Promise((resolve) => {
        finishSave = resolve;
      })
    );
    const onSavingChange = vi.fn();
    const { container } = await renderPermissions(onSavingChange);
    const user = roleSection('user');
    const upload = user.getByLabelText('attachment.upload');
    const storage = user.getByTestId('permission-resource.storage.unlimited');
    const video = user.getByTestId('permission-attachment.video.upload');
    const moderatorUpload = roleSection('moderator').getByLabelText('attachment.upload');

    expect(container.querySelector('[data-slot="admin-settings-actions"]')).toBeNull();
    expect(storage).toHaveAttribute('data-options', 'inherit,allow,deny');
    expect(within(storage).getByRole('combobox')).toHaveValue('inherit');
    expect(within(storage).getByText('effective.denied')).toBeVisible();
    expect(within(video).getByText('effective.allowed')).toBeVisible();
    expect(put).not.toHaveBeenCalled();

    fireEvent.change(upload, { target: { value: 'deny' } });

    expect(put).toHaveBeenCalledExactlyOnceWith('/admin/permissions/roles/user', {
      capabilities: { 'attachment.upload': 'deny' },
    });
    expect(onSavingChange).toHaveBeenLastCalledWith(true);
    expect(user.getByRole('status')).toHaveTextContent('saving');
    expect(upload).toHaveValue('deny');
    expect(upload).toBeDisabled();
    expect(moderatorUpload).toBeDisabled();

    await act(async () => finishSave({ data: updatedPolicies }));

    expect(upload).toHaveValue('deny');
    expect(within(storage).getByRole('combobox')).toHaveValue('inherit');
    expect(within(video).getByText('effective.denied')).toBeVisible();
    expect(moderatorUpload).toHaveValue('allow');
    expect(moderatorUpload).toBeEnabled();
    expect(onSavingChange).toHaveBeenLastCalledWith(false);
    expect(user.getByRole('status')).toBeEmptyDOMElement();
    expect(toast.success).toHaveBeenCalledWith('saveSuccess');
  });

  it('restores the confirmed selection on failure and lets the same choice be retried', async () => {
    put.mockRejectedValueOnce(new Error('save rejected'));
    const onSavingChange = vi.fn();
    await renderPermissions(onSavingChange);
    const upload = roleSection('user').getByLabelText('attachment.upload');

    fireEvent.change(upload, { target: { value: 'deny' } });

    await waitFor(() => expect(upload).toBeEnabled());
    expect(upload).toHaveValue('allow');
    expect(toast.error).toHaveBeenCalledWith('saveFailed');
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onSavingChange).toHaveBeenLastCalledWith(false);

    fireEvent.change(upload, { target: { value: 'deny' } });

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(put).toHaveBeenCalledTimes(2);
    expect(upload).toHaveValue('deny');
  });

  it('keeps role defaults read-only for regular administrators', async () => {
    useProfile.mockReturnValue({ role: 'admin' });
    await renderPermissions();

    expect(screen.getByText('readOnlyDescription')).toBeVisible();
    for (const select of screen.getAllByRole('combobox')) {
      expect(select).toBeDisabled();
    }
    expect(put).not.toHaveBeenCalled();
  });
});
