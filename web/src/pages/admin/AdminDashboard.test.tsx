import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { toast } from 'sonner';
import { SWRConfig, useSWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get, put } from '@/utils/api';
import AdminDashboard from './index';
import type { SystemConfig } from './types';

vi.unmock('react-dom/client');
vi.mock('@/utils/api', () => ({
  get: vi.fn(),
  put: vi.fn(),
  getApiUrl: () => 'https://rote.example/v2/api',
}));
vi.mock('@/state/profile', () => ({
  useAuthState: () => ({ authReady: true, profile: { role: 'super_admin' } }),
}));
vi.mock('@/components/layout/navBar', () => ({ default: () => null }));
vi.mock('@/layout/ContainerWithSideBar', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('./components/DashboardTab', () => ({ default: () => <p>Dashboard content</p> }));
vi.mock('./components/StorageConfigTab', () => ({ default: () => <p>Storage content</p> }));
vi.mock('./components/UpdateBanner', () => ({ default: () => null }));
vi.mock('./components/UsersTab', () => ({ default: () => null }));
vi.mock('./components/PermissionsTab', () => ({ default: () => null }));
vi.mock('./components/AIConfigTab', () => ({ default: () => null }));
vi.mock('./components/HooksConfigTab', () => ({ default: () => null }));

let serverConfig: SystemConfig;

beforeEach(() => {
  vi.clearAllMocks();
  serverConfig = { site: { name: 'Rote', frontendUrl: 'https://rote.example' } };
  vi.mocked(get).mockReset();
  vi.mocked(get).mockImplementation(async () => ({ data: structuredClone(serverConfig) }));
  vi.mocked(put).mockReset();
  vi.mocked(put).mockResolvedValue({});
});

function RefreshControl() {
  const { mutate } = useSWRConfig();
  return <button onClick={() => void mutate('/admin/settings')}>Refresh settings</button>;
}

async function mount() {
  const router = createMemoryRouter([{ path: '/admin', element: <AdminDashboard /> }], {
    initialEntries: ['/admin'],
  });
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, errorRetryCount: 0 }}>
      <RefreshControl />
      <RouterProvider router={router} />
    </SWRConfig>
  );
  await screen.findByText('Dashboard content');
}

function tab(name: string) {
  fireEvent.click(screen.getByRole('button', { name: `tabs.${name}` }));
}

function editSite(name = 'Draft site') {
  fireEvent.change(screen.getByLabelText('site.name'), { target: { value: name } });
}

function unload() {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('admin settings unsaved changes integration', () => {
  it('keeps missing optional settings and an untouched OAuth page clean', async () => {
    await mount();
    for (const name of ['site', 'storage', 'ui', 'oauth', 'dashboard']) {
      tab(name);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(unload()).toBe(false);
    }
    expect(screen.getByText('Dashboard content')).toBeVisible();
    expect(put).not.toHaveBeenCalled();
  });

  it('preserves a site draft when staying and discards it only after confirmation', async () => {
    await mount();
    tab('site');
    editSite();
    expect(unload()).toBe(true);
    tab('storage');
    expect(screen.getByRole('dialog')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'continueEditing' }));
    expect(screen.getByLabelText('site.name')).toHaveValue('Draft site');
    tab('storage');
    fireEvent.click(screen.getByRole('button', { name: 'discardAndLeave' }));
    expect(screen.getByText('Storage content')).toBeVisible();
    expect(unload()).toBe(false);
    tab('site');
    expect(screen.getByLabelText('site.name')).toHaveValue('Rote');
    expect(put).not.toHaveBeenCalled();
  });

  it('clears protection as soon as PUT succeeds while revalidation is still pending', async () => {
    await mount();
    tab('site');
    editSite();
    let completeRefresh!: (response: { data: SystemConfig }) => void;
    vi.mocked(get).mockImplementation(() => new Promise((resolve) => (completeRefresh = resolve)));
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('saveSuccess'));
    expect(put).toHaveBeenCalledWith('/admin/settings', {
      group: 'site',
      config: expect.objectContaining({ name: 'Draft site' }),
    });
    expect(get).toHaveBeenCalledTimes(2);
    expect(unload()).toBe(false);
    tab('storage');
    expect(screen.getByText('Storage content')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await act(async () => {
      completeRefresh({
        data: { ...serverConfig, site: { ...serverConfig.site!, name: 'Draft site' } },
      });
    });
  });

  it('continues protecting the draft after a failed save', async () => {
    await mount();
    tab('site');
    editSite();
    vi.mocked(put).mockRejectedValueOnce(new Error('Save rejected'));
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('saveFailed'));
    expect(unload()).toBe(true);
    tab('storage');
    expect(screen.getByRole('dialog')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'continueEditing' }));
    expect(screen.getByLabelText('site.name')).toHaveValue('Draft site');
  });

  it('preserves local edits when SWR reloads settings changed elsewhere', async () => {
    await mount();
    tab('site');
    editSite();
    serverConfig = {
      ...serverConfig,
      site: { ...serverConfig.site!, name: 'Changed elsewhere', description: 'Remote description' },
    };
    fireEvent.click(screen.getByRole('button', { name: 'Refresh settings' }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('site.name')).toHaveValue('Draft site');
    expect(unload()).toBe(true);
    tab('storage');
    fireEvent.click(screen.getByRole('button', { name: 'discardAndLeave' }));
    tab('site');
    expect(screen.getByLabelText('site.name')).toHaveValue('Changed elsewhere');
  });

  it('saves security policy changes immediately and releases navigation after the write', async () => {
    await mount();
    tab('ui');
    fireEvent.click(screen.getAllByRole('switch')[2]);
    expect(unload()).toBe(true);
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/admin/settings', {
        group: 'security',
        config: { requireCertifiedUserForExplore: true },
      })
    );
    await waitFor(() => expect(unload()).toBe(false));
    tab('oauth');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('protects an unfinished automatic-save number field without submitting it', async () => {
    await mount();
    tab('ui');
    fireEvent.change(screen.getByLabelText('ui.apiRateLimit'), { target: { value: '5' } });
    expect(unload()).toBe(true);
    tab('oauth');
    expect(await screen.findByRole('dialog')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'continueEditing' }));
    expect(screen.getByLabelText('ui.apiRateLimit')).toHaveValue(5);
    expect(put).not.toHaveBeenCalled();
  });
});
