import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SystemConfig } from '../types';
import AIConfigTab from './AIConfigTab';
import SiteConfigTab from './SiteConfigTab';
import StorageConfigTab from './StorageConfigTab';

const { put, post, onMutate, mutate, onSaved } = vi.hoisted(() => ({
  put: vi.fn(),
  post: vi.fn(),
  onMutate: vi.fn(),
  mutate: vi.fn(),
  onSaved: vi.fn(),
}));

vi.unmock('react-dom/client');
vi.mock('@/utils/api', () => ({ get: vi.fn(), put, post }));
vi.mock('@/components/common/S3ConfigForm', () => ({ default: () => null }));
vi.mock('./AIConfigProviderForm', () => ({ default: () => null }));
vi.mock('./AIConfigAdvancedSettings', () => ({ default: () => null }));
vi.mock('swr', () => ({
  useSWRConfig: () => ({ mutate }),
  default: (key: string) => ({
    data:
      key === '/ai/defaults'
        ? aiConfig
        : key === '/admin/settings?group=ai'
          ? { config: aiConfig }
          : key === '/ai/providers'
            ? []
            : {},
    mutate,
  }),
}));

const aiConfig: NonNullable<SystemConfig['ai']> = {
  schemaVersion: 2,
  revision: 1,
  enabled: false,
};

function Settings({ tab }: { tab: 'site' | 'storage' | 'ai' }) {
  const [isSaving, setIsSaving] = useState(false);
  const props = { isSaving, setIsSaving, onMutate, onSaved, hasUnsavedChanges: true };
  if (tab === 'ai') {
    return <AIConfigTab {...props} aiConfig={aiConfig} setAiConfig={vi.fn()} />;
  }
  if (tab === 'storage') {
    return (
      <StorageConfigTab
        {...props}
        storageConfig={{
          endpoint: 'https://storage.example',
          bucket: 'rote',
          accessKeyId: 'example',
          secretAccessKey: 'example',
          urlPrefix: 'https://files.example',
        }}
        setStorageConfig={vi.fn()}
        isTesting={false}
        setIsTesting={vi.fn()}
      />
    );
  }
  return (
    <SiteConfigTab
      {...props}
      siteConfig={{ name: 'Rote', frontendUrl: 'https://rote.example' }}
      setSiteConfig={vi.fn()}
      isSuperAdmin={false}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  put.mockReset();
  put.mockResolvedValue({ data: { config: aiConfig } });
  post.mockResolvedValue({ data: { requiresConfirmation: false } });
  const pendingRefresh = new Promise(() => {});
  onMutate.mockReturnValue(pendingRefresh);
  mutate.mockReturnValue(pendingRefresh);
});

describe('admin settings save feedback', () => {
  it('shows save errors beside the actions and clears them when retrying', async () => {
    put.mockRejectedValueOnce(new Error('Save rejected'));
    render(<Settings tab="site" />);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('saveFailed');
    expect(error.closest('[data-slot="admin-settings-actions"]')).not.toBeNull();
    expect(
      screen.getByText('status').closest('[data-slot="admin-settings-actions"]')
    ).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(['storage', 'ai'] as const)(
    '%s releases the save controls after PUT while read refreshes remain pending',
    async (tab) => {
      render(<Settings tab={tab} />);
      fireEvent.click(screen.getByRole('button', { name: 'save' }));
      await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
      await waitFor(() => expect(screen.getByRole('button', { name: 'save' })).toBeEnabled());
      expect(onMutate).toHaveBeenCalledOnce();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    }
  );
});
