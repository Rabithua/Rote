import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
