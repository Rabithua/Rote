import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SystemConfig } from '../types';
import AIConfigTab from './AIConfigTab';
import SiteConfigTab from './SiteConfigTab';
import UIConfigTab from './UIConfigTab';

const { put, post, mutate, onMutate } = vi.hoisted(() => ({
  put: vi.fn(),
  post: vi.fn(),
  mutate: vi.fn(),
  onMutate: vi.fn(),
}));

vi.mock('@/utils/api', () => ({ put, post, get: vi.fn() }));
vi.mock('swr', () => ({
  default: () => ({ data: undefined, mutate }),
  useSWRConfig: () => ({ mutate }),
}));
vi.unmock('react-dom/client');

const siteConfig: NonNullable<SystemConfig['site']> = {
  name: 'Rote',
  frontendUrl: 'https://rote.example',
};
const aiConfig: NonNullable<SystemConfig['ai']> = {
  schemaVersion: 2,
  revision: 1,
  enabled: false,
  chat: { providerId: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'chat-model' },
  embedding: {
    providerId: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'embedding-model',
    output: { mode: 'native' },
  },
};

function SiteSettings({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [config, setConfig] = useState<SystemConfig['site']>({
    ...siteConfig,
    customMetaTags: '<meta name="twitter:creator" content="@rote">',
  });
  const [isSaving, setIsSaving] = useState(false);
  return (
    <SiteConfigTab
      siteConfig={config}
      setSiteConfig={setConfig}
      isSaving={isSaving}
      setIsSaving={setIsSaving}
      isSuperAdmin={isSuperAdmin}
      onMutate={onMutate}
    />
  );
}

describe('acknowledging saved admin settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    put.mockReset().mockResolvedValue({});
    post.mockReset().mockResolvedValue({ data: { requiresConfirmation: false } });
  });

  it('acknowledges the submitted site snapshot before revalidating the cache', async () => {
    const onSaved = vi.fn();
    onMutate.mockImplementationOnce(() => expect(onSaved).toHaveBeenCalledWith(siteConfig));
    render(
      <SiteConfigTab
        siteConfig={siteConfig}
        setSiteConfig={vi.fn()}
        isSaving={false}
        setIsSaving={vi.fn()}
        isSuperAdmin={false}
        onMutate={onMutate}
        onSaved={onSaved}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => expect(onMutate).toHaveBeenCalledOnce());
    expect(onSaved).toHaveBeenCalledExactlyOnceWith(siteConfig);
  });

  it('does not acknowledge a rejected site save', async () => {
    put.mockRejectedValueOnce(new Error('offline'));
    const onSaved = vi.fn();
    const setIsSaving = vi.fn();
    render(
      <SiteConfigTab
        siteConfig={siteConfig}
        setSiteConfig={vi.fn()}
        isSaving={false}
        setIsSaving={setIsSaving}
        isSuperAdmin={false}
        onMutate={onMutate}
        onSaved={onSaved}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => expect(setIsSaving).toHaveBeenLastCalledWith(false));
    expect(onSaved).not.toHaveBeenCalled();
    expect(onMutate).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'omits custom meta for an admin and allows a super admin to clear it (super admin: %s)',
    async (isSuperAdmin) => {
      render(<SiteSettings isSuperAdmin={isSuperAdmin} />);
      if (isSuperAdmin) {
        fireEvent.change(screen.getByLabelText('site.customMetaTags.title'), {
          target: { value: '' },
        });
      } else {
        expect(screen.queryByLabelText('site.customMetaTags.title')).not.toBeInTheDocument();
      }
      fireEvent.click(screen.getByRole('button', { name: 'save' }));
      await waitFor(() => expect(onMutate).toHaveBeenCalledOnce());
      expect(put).toHaveBeenCalledExactlyOnceWith('/admin/settings', {
        group: 'site',
        config: isSuperAdmin ? { ...siteConfig, customMetaTags: '' } : siteConfig,
      });
    }
  );

  it.each([
    ['invalid_custom_meta_tags', 'site.customMetaTags.invalid'],
    ['custom_meta_tags_forbidden', 'site.customMetaTags.forbidden'],
  ])('shows a toast and keeps the meta draft on %s', async (message, translationKey) => {
    put.mockRejectedValueOnce({ response: { data: { message } } });
    render(<SiteSettings isSuperAdmin />);
    const field = screen.getByLabelText('site.customMetaTags.title');
    const draft = '<meta name="twitter:creator" content="@new_handle">';
    fireEvent.change(field, { target: { value: draft } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledExactlyOnceWith(translationKey));
    expect(field).toHaveValue(draft);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onMutate).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'acknowledges only an actually saved UI snapshot (failure: %s)',
    async (fails) => {
      if (fails) put.mockRejectedValueOnce(new Error('offline'));
      const onSaved = vi.fn();
      const onSavingChange = vi.fn();
      render(
        <UIConfigTab
          uiConfig={{ allowRegistration: true, apiRateLimit: 100 }}
          securityConfig={{ requireCertifiedUserForExplore: true }}
          onMutate={onMutate}
          onSaved={onSaved}
          onSavingChange={onSavingChange}
        />
      );
      fireEvent.click(screen.getByRole('switch', { name: 'ui.allowRegistration' }));
      await waitFor(() => expect(onSavingChange).toHaveBeenLastCalledWith(false));
      if (fails) expect(onSaved).not.toHaveBeenCalled();
      else
        expect(onSaved).toHaveBeenCalledExactlyOnceWith({
          ui: expect.objectContaining({ allowRegistration: false, apiRateLimit: 100 }),
        });
      expect(put).toHaveBeenCalledOnce();
    }
  );

  it('acknowledges the server AI revision without overwriting newer parent edits', async () => {
    const persisted = { ...aiConfig, revision: 2 };
    put.mockResolvedValueOnce({ data: { config: persisted } });
    const onSaved = vi.fn();
    const setAiConfig = vi.fn();
    render(
      <AIConfigTab
        aiConfig={aiConfig}
        setAiConfig={setAiConfig}
        isSaving={false}
        setIsSaving={vi.fn()}
        onMutate={onMutate}
        onSaved={onSaved}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledExactlyOnceWith(persisted));
    expect(setAiConfig).not.toHaveBeenCalled();
  });
});
