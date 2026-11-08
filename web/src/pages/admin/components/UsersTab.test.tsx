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
  default: ({ onSavingChange }: { onSavingChange?: (saving: boolean) => void }) => (
    <>
      <button onClick={() => onSavingChange?.(true)}>Start permission save</button>
      <button onClick={() => onSavingChange?.(false)}>Finish permission save</button>
    </>
  ),
}));
describe('user list permission protection', () => {
  it('forwards pending and finished permission saves to the administrator page', () => {
    const onSavingChange = vi.fn();
    render(<UsersTab onSavingChange={onSavingChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start permission save' }));
    expect(onSavingChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Finish permission save' }));
    expect(onSavingChange).toHaveBeenLastCalledWith(false);
  });
});
