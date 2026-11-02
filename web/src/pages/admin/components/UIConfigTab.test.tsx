import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UIConfigTab from './UIConfigTab';

const { put, mutate } = vi.hoisted(() => ({ put: vi.fn(), mutate: vi.fn() }));
vi.mock('@/utils/api', () => ({ put }));
vi.mock('swr', () => ({ useSWRConfig: () => ({ mutate }) }));
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
      aria-label="ui.defaultUserRole"
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
const uiConfig = {
  allowRegistration: true,
  allowUploadFile: true,
  defaultUserRole: 'user',
  apiRateLimit: 100,
  maxVideoUploadSizeMB: 300,
};
const props = {
  uiConfig,
  securityConfig: { requireCertifiedUserForExplore: false },
  onMutate: vi.fn(),
};
function toggle(field: string) {
  fireEvent.click(screen.getByRole('switch', { name: field }));
}
function rate() {
  return screen.getByLabelText('ui.apiRateLimit');
}

beforeEach(() => {
  vi.clearAllMocks();
  put.mockReset().mockResolvedValue({});
  mutate.mockResolvedValue(undefined);
});

describe('system settings autosave', () => {
  it('writes independent UI and security changes without a save button', async () => {
    const onSaved = vi.fn();
    render(<UIConfigTab {...props} onSaved={onSaved} />);
    expect(screen.queryByRole('button', { name: 'save' })).not.toBeInTheDocument();
    toggle('ui.allowRegistration');
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith({ ui: { ...uiConfig, allowRegistration: false } })
    );
    toggle('security.requireCertifiedUserForExplore');
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith({ requireCertifiedUserForExplore: true })
    );
    expect(put).toHaveBeenLastCalledWith('/admin/settings', {
      group: 'security',
      config: { requireCertifiedUserForExplore: true },
    });
  });

  it('serializes full UI snapshots and never sends an unfinished number', async () => {
    let finish!: (response: unknown) => void;
    put.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const onDirtyChange = vi.fn();
    render(<UIConfigTab {...props} onDirtyChange={onDirtyChange} />);
    fireEvent.change(rate(), { target: { value: '' } });
    toggle('ui.allowRegistration');
    toggle('ui.allowUploadFile');
    expect(put).toHaveBeenCalledTimes(1);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await act(async () => finish({}));
    expect(put).toHaveBeenNthCalledWith(2, '/admin/settings', {
      group: 'ui',
      config: { ...uiConfig, allowRegistration: false, allowUploadFile: false },
    });
    expect(rate()).toHaveValue(null);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it('rolls back a failed toggle and does not include it in the next queued snapshot', async () => {
    let reject!: (error: Error) => void;
    put.mockReturnValueOnce(
      new Promise((_resolve, rejectOperation) => {
        reject = rejectOperation;
      })
    );
    render(<UIConfigTab {...props} />);
    toggle('ui.allowRegistration');
    toggle('ui.allowUploadFile');
    await act(async () => reject(new Error('offline')));
    expect(screen.getByRole('switch', { name: 'ui.allowRegistration' })).toBeChecked();
    expect(put).toHaveBeenNthCalledWith(2, '/admin/settings', {
      group: 'ui',
      config: { ...uiConfig, allowUploadFile: false },
    });
    expect(screen.getByText('failed')).toBeVisible();
  });

  it('validates complete numeric input and commits on Enter', async () => {
    const onDirtyChange = vi.fn();
    render(<UIConfigTab {...props} onDirtyChange={onDirtyChange} />);
    fireEvent.change(rate(), { target: { value: '9' } });
    fireEvent.blur(rate());
    expect(put).not.toHaveBeenCalled();
    expect(screen.getByText('invalidRateLimit')).toBeVisible();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    fireEvent.change(rate(), { target: { value: '250' } });
    expect(put).not.toHaveBeenCalled();
    fireEvent.keyDown(rate(), { key: 'Enter' });
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    expect(put).toHaveBeenCalledExactlyOnceWith('/admin/settings', {
      group: 'ui',
      config: { ...uiConfig, apiRateLimit: 250 },
    });
  });

  it('retains a failed numeric draft for explicit retry', async () => {
    put.mockRejectedValueOnce(new Error('offline'));
    const onDirtyChange = vi.fn();
    render(<UIConfigTab {...props} onDirtyChange={onDirtyChange} />);
    fireEvent.change(rate(), { target: { value: '250' } });
    fireEvent.blur(rate());
    await screen.findByRole('button', { name: 'retry' });
    expect(rate()).toHaveValue(250);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    expect(put).toHaveBeenCalledTimes(2);
    expect(rate()).toHaveValue(250);
  });

  it('preserves number input across SWR updates and includes current confirmed fields on commit', async () => {
    const { rerender } = render(<UIConfigTab {...props} />);
    fireEvent.change(rate(), { target: { value: '250' } });
    rerender(<UIConfigTab {...props} uiConfig={{ ...uiConfig, allowUploadFile: false }} />);
    expect(rate()).toHaveValue(250);
    expect(screen.getByRole('switch', { name: 'ui.allowUploadFile' })).not.toBeChecked();
    fireEvent.blur(rate());
    await waitFor(() =>
      expect(put).toHaveBeenCalledExactlyOnceWith('/admin/settings', {
        group: 'ui',
        config: { ...uiConfig, allowUploadFile: false, apiRateLimit: 250 },
      })
    );
  });

  it('rolls back a failed role selection and permits retry', async () => {
    put.mockRejectedValueOnce(new Error('offline'));
    render(<UIConfigTab {...props} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'moderator' } });
    await screen.findByRole('button', { name: 'retry' });
    expect(screen.getByRole('combobox')).toHaveValue('user');
    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('moderator'));
    expect(put).toHaveBeenCalledTimes(2);
  });

  it('adopts a UI refresh during a security write before the next full UI snapshot', async () => {
    let finish!: (response: unknown) => void;
    put.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const { rerender } = render(<UIConfigTab {...props} />);
    toggle('security.requireCertifiedUserForExplore');
    const remote = { ...uiConfig, allowUploadFile: false };
    rerender(<UIConfigTab {...props} uiConfig={remote} />);
    expect(screen.getByRole('switch', { name: 'ui.allowUploadFile' })).not.toBeChecked();
    toggle('ui.allowRegistration');
    expect(put).toHaveBeenCalledTimes(1);
    await act(async () => finish({}));
    expect(put).toHaveBeenNthCalledWith(2, '/admin/settings', {
      group: 'ui',
      config: { ...remote, allowRegistration: false },
    });
  });

  it('keeps queued UI edits when a refresh arrives during an intervening security write', async () => {
    const onSaved = vi.fn();
    const { rerender } = render(<UIConfigTab {...props} onSaved={onSaved} />);
    toggle('ui.allowRegistration');
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    let finish!: (response: unknown) => void;
    put.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    toggle('security.requireCertifiedUserForExplore');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'moderator' } });
    const remote = { ...uiConfig, allowRegistration: false, allowUploadFile: false };
    rerender(<UIConfigTab {...props} uiConfig={remote} onSaved={onSaved} />);
    expect(screen.getByRole('combobox')).toHaveValue('moderator');
    expect(screen.getByRole('switch', { name: 'ui.allowUploadFile' })).not.toBeChecked();
    await act(async () => finish({}));
    expect(put).toHaveBeenNthCalledWith(3, '/admin/settings', {
      group: 'ui',
      config: { ...remote, defaultUserRole: 'moderator' },
    });
  });

  it('does not let a pre-success UI refresh undo an acknowledged write or its queued changes', async () => {
    let finish!: (response: unknown) => void;
    put.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const { rerender } = render(<UIConfigTab {...props} />);
    toggle('ui.allowRegistration');
    toggle('ui.allowUploadFile');
    rerender(<UIConfigTab {...props} uiConfig={{ ...uiConfig, defaultUserRole: 'moderator' }} />);
    await act(async () => finish({}));
    expect(put).toHaveBeenNthCalledWith(2, '/admin/settings', {
      group: 'ui',
      config: { ...uiConfig, allowRegistration: false, allowUploadFile: false },
    });
    expect(screen.getByRole('switch', { name: 'ui.allowRegistration' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'ui.allowUploadFile' })).not.toBeChecked();
  });

  it('uses a refresh received during a rejected UI write as the next queued snapshot baseline', async () => {
    let reject!: (error: Error) => void;
    put.mockReturnValueOnce(
      new Promise((_resolve, rejectOperation) => {
        reject = rejectOperation;
      })
    );
    const { rerender } = render(<UIConfigTab {...props} />);
    toggle('ui.allowRegistration');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'moderator' } });
    const remote = { ...uiConfig, allowUploadFile: false };
    rerender(<UIConfigTab {...props} uiConfig={remote} />);
    await act(async () => reject(new Error('offline')));
    expect(put).toHaveBeenNthCalledWith(2, '/admin/settings', {
      group: 'ui',
      config: { ...remote, defaultUserRole: 'moderator' },
    });
    expect(screen.getByRole('switch', { name: 'ui.allowRegistration' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'ui.allowUploadFile' })).not.toBeChecked();
  });
});
