import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SystemConfig } from '../types';
import { useAdminSettingsDrafts } from './useAdminSettingsDrafts';

vi.unmock('react-dom/client');
vi.mock('@/utils/api', () => ({ getApiUrl: () => 'https://rote.example/v2/api' }));

const initial: SystemConfig = {
  site: { name: 'Rote', frontendUrl: 'https://rote.example' },
  ai: { schemaVersion: 2, revision: 1, enabled: false },
};

describe('admin settings drafts', () => {
  it('starts clean with missing optional settings and clears reverted changes', () => {
    const { result, rerender } = renderHook((configs) => useAdminSettingsDrafts(configs), {
      initialProps: undefined as SystemConfig | undefined,
    });
    expect(result.current.hasUnsavedChanges).toBe(false);
    rerender(initial);
    expect(result.current.hasUnsavedChanges).toBe(false);
    const saved = result.current.site.value;
    act(() => result.current.site.setValue({ ...saved!, name: 'Changed' }));
    expect(result.current.hasUnsavedChanges).toBe(true);
    act(() => result.current.site.setValue({ ...saved! }));
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('preserves edited groups on refresh and discards to the latest server values', () => {
    const { result, rerender } = renderHook((configs) => useAdminSettingsDrafts(configs), {
      initialProps: initial,
    });
    act(() => result.current.site.setValue({ ...result.current.site.value!, name: 'Draft' }));
    rerender({
      ...initial,
      site: { ...initial.site!, name: 'Remote update' },
      ui: { allowRegistration: false },
    });
    expect(result.current.site.value?.name).toBe('Draft');
    expect(result.current.ui.value?.allowRegistration).toBe(false);
    expect(result.current.hasUnsavedChanges).toBe(true);
    act(() => result.current.discard());
    expect(result.current.site.value?.name).toBe('Remote update');
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('acknowledges writes immediately and preserves edits made after the submitted snapshot', () => {
    const { result } = renderHook(() => useAdminSettingsDrafts(initial));
    act(() => result.current.site.setValue({ ...result.current.site.value!, name: 'Saved' }));
    const submitted = result.current.site.value;
    act(() => result.current.site.markSaved(submitted));
    expect(result.current.hasUnsavedChanges).toBe(false);
    act(() => result.current.site.setValue({ ...submitted!, name: 'Next edit' }));
    act(() => result.current.site.markSaved(submitted));
    expect(result.current.site.value?.name).toBe('Next edit');
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('uses the returned AI revision as the saved baseline without waiting for refresh', () => {
    const { result, rerender } = renderHook((configs) => useAdminSettingsDrafts(configs), {
      initialProps: initial,
    });
    act(() => result.current.ai.setValue({ ...result.current.ai.value!, enabled: true }));
    const submitted = result.current.ai.value;
    const persisted = { ...submitted!, revision: 2 };
    act(() => result.current.ai.markSaved(submitted, persisted));
    expect(result.current.ai.value).toEqual(persisted);
    expect(result.current.hasUnsavedChanges).toBe(false);
    rerender({ ...initial, ai: persisted });
    expect(result.current.ai.value).toEqual(persisted);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });
});
