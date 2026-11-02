import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UsersTab from './UsersTab';
vi.unmock('react-dom/client');
vi.mock('@/state/profile', () => ({ useProfile: () => ({ role: 'super_admin' }) }));
vi.mock('@/utils/api', () => ({ get: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('swr', () => ({
  default: () => ({
    data: { users: [], pagination: { page: 1, pages: 1, limit: 10, total: 0 } },
    isLoading: false,
    mutate: vi.fn(),
  }),
}));
vi.mock('./UserPermissionsDialog', () => ({
  default: ({
    onDirtyChange,
    onSavingChange,
  }: {
    onDirtyChange?: (dirty: boolean) => void;
    onSavingChange?: (saving: boolean) => void;
  }) => (
    <>
      <button onClick={() => onDirtyChange?.(true)}>Edit permissions</button>
      <button onClick={() => onSavingChange?.(true)}>Save permissions</button>
    </>
  ),
}));
describe('user list permission protection', () => {
  it('forwards permission dialog dirty and saving state to the administrator page', () => {
    const onDirtyChange = vi.fn();
    const onSavingChange = vi.fn();
    render(<UsersTab onDirtyChange={onDirtyChange} onSavingChange={onSavingChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit permissions' }));
    expect(onDirtyChange).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save permissions' }));
    expect(onSavingChange).toHaveBeenCalledWith(true);
  });
});
