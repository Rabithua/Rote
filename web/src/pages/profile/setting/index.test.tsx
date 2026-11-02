import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import type { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { profileAtom, userSettingsAtom } from '@/state/profile';
import type { Profile } from '@/types/main';
import { get, put } from '@/utils/api';
import SettingsPage from './index';

vi.mock('@/utils/api', () => ({ get: vi.fn(), put: vi.fn(), del: vi.fn(), post: vi.fn() }));
vi.mock('@/layout/ContainerWithSideBar', () => ({
  default: ({ children }: PropsWithChildren) => <main>{children}</main>,
}));
vi.mock('@/components/layout/navBar', () => ({ default: () => null }));
vi.mock('../components/ProfileSidebar', () => ({ default: () => null }));
vi.mock('@/components/theme-provider', () => ({
  useTheme: () => ({ theme: 'system', setTheme: vi.fn() }),
}));
vi.mock('@/hooks/useSiteStatus', () => ({
  useSiteStatus: () => ({ data: { passkey: { enabled: false } } }),
}));
vi.mock('@/features/resources/useResourceState', () => ({
  isOfficialApiOrigin: () => false,
  useResourceState: () => ({}),
}));
vi.mock('@/hooks/usePasskey', () => ({
  usePasskey: () => ({ passkeys: [], isLoading: false, isRegistering: false }),
}));
vi.mock('../hooks/useOAuthBinding', () => {
  const handleOAuthCallback = vi.fn();
  return { useOAuthBinding: () => ({ handleOAuthCallback }) };
});

async function renderSettings() {
  const store = createStore();
  store.set(profileAtom, { id: 'user', username: 'test' } as Profile);
  render(
    <Provider store={store}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </Provider>
  );
  await waitFor(() => expect(get).toHaveBeenCalledWith('/users/me/settings'));
  return store;
}

describe('SettingsPage preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(get).mockResolvedValue({ data: { allowExplore: true } });
  });

  it('saves the Explore switch immediately and updates shared settings after success', async () => {
    let finishSave!: (value: unknown) => void;
    vi.mocked(put).mockImplementation(() => new Promise((resolve) => (finishSave = resolve)));
    const store = await renderSettings();
    const toggle = screen.getByRole('switch', { name: 'settings.allowExploreLabel' });

    expect(screen.queryByRole('button', { name: 'settings.save' })).not.toBeInTheDocument();
    fireEvent.click(toggle);

    expect(put).toHaveBeenCalledWith('/users/me/settings', { allowExplore: false });
    expect(toggle).toBeDisabled();
    expect(store.get(userSettingsAtom).allowExplore).toBe(true);

    await act(async () => finishSave({ data: { allowExplore: false } }));

    expect(toggle).toBeEnabled();
    expect(toggle).not.toBeChecked();
    expect(store.get(userSettingsAtom).allowExplore).toBe(false);
    expect(toast.success).toHaveBeenCalledWith('settings.saveSuccess');
  });

  it('keeps the saved Explore preference when its update fails', async () => {
    vi.mocked(put).mockRejectedValue(new Error('Connection lost'));
    const store = await renderSettings();
    const toggle = screen.getByRole('switch', { name: 'settings.allowExploreLabel' });

    fireEvent.click(toggle);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('settings.saveFailed'));

    expect(toggle).toBeEnabled();
    expect(toggle).toBeChecked();
    expect(store.get(userSettingsAtom).allowExplore).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
