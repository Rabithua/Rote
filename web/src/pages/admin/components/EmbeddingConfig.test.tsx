import AIConfigSaveButton from './AIConfigSaveButton';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AIConfigProviderForm from './AIConfigProviderForm';
import EmbeddingRebuildButton from './EmbeddingRebuildButton';
import type { SystemConfig } from '../types';
import { post } from '@/utils/api';

vi.mock('@/utils/api', () => ({ post: vi.fn() }));
const config: NonNullable<SystemConfig['ai']> = {
  schemaVersion: 2,
  revision: 1,
  enabled: true,
  vectorEnabled: true,
  embedding: {
    providerId: 'siliconflow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'BAAI/bge-m3',
    output: { mode: 'native' },
  },
};
function form(next = config) {
  return (
    <AIConfigProviderForm
      target="embedding"
      config={next}
      providers={[]}
      busyAction={null}
      updateProvider={vi.fn()}
      applyPreset={vi.fn()}
    />
  );
}
beforeEach(() => {
  vi.mocked(post).mockReset();
});
describe('embedding configuration', () => {
  it('does not show an editable dimension for native models, and invalidates results after edits', async () => {
    vi.mocked(post).mockResolvedValue({ data: { dimensions: 1024 } });
    const view = render(form());
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ai.test' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('ai.detectedDimensions')
    );
    expect(post).toHaveBeenCalledWith('/ai/test', { target: 'embedding', config });
    view.rerender(form({ ...config, embedding: { ...config.embedding!, model: 'different' } }));
    expect(screen.getByRole('status')).toHaveTextContent('ai.dimensionTestRequired');
  });
  it('bounds requested dimensions using the storage contract', () => {
    render(
      form({
        ...config,
        embedding: { ...config.embedding!, output: { mode: 'dimensions', dimensions: 1024 } },
      })
    );
    expect(screen.getByRole('spinbutton')).toHaveAttribute('max', '2000');
    expect(screen.getByRole('spinbutton')).toHaveAttribute('min', '1');
    expect(screen.getByRole('spinbutton')).toHaveValue(1024);
  });
  it('ignores a successful test for configuration edited while the test was pending', async () => {
    let resolve!: (value: { data: { dimensions: number } }) => void;
    vi.mocked(post).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    const view = render(form());
    fireEvent.click(screen.getByRole('button', { name: 'ai.test' }));
    view.rerender(
      form({ ...config, embedding: { ...config.embedding!, baseUrl: 'https://other.test/v1' } })
    );
    resolve({ data: { dimensions: 1024 } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'ai.test' })).toBeEnabled());
    expect(screen.getByRole('status')).toHaveTextContent('ai.dimensionTestRequired');
  });
  it('requires an explicit rebuild action with its configuration revision', async () => {
    vi.mocked(post).mockResolvedValue({ data: { status: 'rebuilding' } });
    const runAction = vi.fn(async (_key, action) => {
      await action();
    });
    render(<EmbeddingRebuildButton disabled={false} revision={7} runAction={runAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'rebuild' }));
    expect(screen.getByText('rebuildConfirmation')).toBeVisible();
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'rebuildConfirm' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/ai/index/rebuild', { revision: 7 }));
  });
});

describe('saving embedding configuration', () => {
  it('asks before saving an index change, and cancellation writes nothing', async () => {
    vi.mocked(post).mockResolvedValue({ data: { requiresConfirmation: true } });
    const onSave = vi.fn().mockResolvedValue(true);
    render(<AIConfigSaveButton config={config} disabled={false} onSave={onSave} />);
    const button = screen.getByRole('button', { name: 'save' });
    fireEvent.click(button);
    await screen.findByRole('dialog');
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'ai.saveChangeCancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onSave).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });
  it('saves the reviewed configuration only after confirmation', async () => {
    vi.mocked(post).mockResolvedValue({ data: { requiresConfirmation: true } });
    const onSave = vi.fn().mockResolvedValue(true);
    render(<AIConfigSaveButton config={config} disabled={false} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    fireEvent.click(await screen.findByRole('button', { name: 'ai.saveChangeConfirm' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledExactlyOnceWith(config));
    expect(post).toHaveBeenCalledExactlyOnceWith('/ai/config/impact', { config });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('directly saves unrelated changes and fails closed when the impact check fails', async () => {
    vi.mocked(post)
      .mockResolvedValueOnce({ data: { requiresConfirmation: false } })
      .mockRejectedValueOnce(new Error('offline'));
    const onSave = vi.fn().mockResolvedValue(true);
    render(<AIConfigSaveButton config={config} disabled={false} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'save' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'save' })).toBeEnabled());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('discards an impact check when the form changes during the request', async () => {
    let finish!: (value: { data: { requiresConfirmation: boolean } }) => void;
    vi.mocked(post).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const onSave = vi.fn().mockResolvedValue(true);
    const view = render(<AIConfigSaveButton config={config} disabled={false} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    view.rerender(
      <AIConfigSaveButton config={{ ...config, revision: 2 }} disabled={false} onSave={onSave} />
    );
    finish({ data: { requiresConfirmation: false } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'save' })).toBeEnabled());
    expect(onSave).not.toHaveBeenCalled();
  });
  it('keeps the confirmation open after a rejected save', async () => {
    vi.mocked(post).mockResolvedValue({ data: { requiresConfirmation: true } });
    const onSave = vi.fn().mockResolvedValue(false);
    render(<AIConfigSaveButton config={config} disabled={false} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    fireEvent.click(await screen.findByRole('button', { name: 'ai.saveChangeConfirm' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('dialog')).toBeVisible();
  });
});
