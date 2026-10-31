import { act, renderHook } from '@testing-library/react';
import { createInstance } from 'i18next';
import type { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/locales/en.json';
import ja from '@/locales/ja.json';
import zh from '@/locales/zh.json';
import { useOAuthBinding } from './useOAuthBinding';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
const testI18n = createInstance();

vi.mock('@/utils/api', () => ({ post, get: vi.fn(), del: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      testI18n.t(`pages.profile.${key}`, options),
  }),
}));
vi.unmock('react-dom/client');

function CallbackPage({ children }: PropsWithChildren) {
  return (
    <MemoryRouter
      initialEntries={[
        '/profile/setting?oauth=bind&bind=merge_required&provider=github&existingUserId=source-user&githubUserId=12345&githubUsername=source-github',
      ]}
    >
      {children}
    </MemoryRouter>
  );
}

function renderMerge() {
  const onSuccess = vi.fn();
  const result = renderHook(() => useOAuthBinding(onSuccess), { wrapper: CallbackPage }).result;
  act(() => result.current.handleOAuthCallback());
  return { result, onSuccess };
}

const errorCases = [
  ['oauth_merge_invalid_request', 'invalidRequest'],
  ['oauth_merge_authorization_required', 'authorizationRequired'],
  ['oauth_merge_conflict', 'conflict'],
  ['oauth_merge_billing_blocked', 'billingBlocked'],
  ['oauth_merge_disabled', 'disabled'],
  ['oauth_merge_failed', 'failed'],
] as const;

describe('OAuth account merge compatibility and errors', () => {
  beforeAll(async () => {
    await testI18n.init({
      lng: 'en',
      fallbackLng: 'en',
      resources: { en: { translation: en }, zh: { translation: zh }, ja: { translation: ja } },
      interpolation: { escapeValue: false },
    });
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    post.mockReset();
    await testI18n.changeLanguage('en');
  });

  it('uses the existing callback and request fields and closes the dialog after success', async () => {
    post.mockResolvedValueOnce({ data: { merged: true, mergedData: { notes: 2 } } });
    const { result, onSuccess } = renderMerge();
    expect(result.current.isMergeDialogOpen).toBe(true);

    await act(async () => {
      expect(await result.current.handleConfirmMerge()).toBe(true);
    });

    expect(post).toHaveBeenCalledExactlyOnceWith('/auth/oauth/github/bind/merge', {
      existingUserId: 'source-user',
      githubUserId: '12345',
      githubUsername: 'source-github',
    });
    expect(result.current.isMergeDialogOpen).toBe(false);
    expect(result.current.mergeInfo).toBeNull();
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  for (const [language, translations] of [
    ['en', en],
    ['zh', zh],
    ['ja', ja],
  ] as const) {
    it.each(errorCases)(
      `shows the localized ${language} message for %s`,
      async (errorCode, key) => {
        await testI18n.changeLanguage(language);
        post.mockRejectedValueOnce({
          response: { data: { errorCode, message: 'Internal server detail' } },
        });
        const { result, onSuccess } = renderMerge();

        await act(async () => {
          expect(await result.current.handleConfirmMerge()).toBe(false);
        });

        const messages = translations.pages.profile.settings.oauth;
        expect(toast.error).toHaveBeenCalledWith(
          messages.mergeFailed.replace('{{error}}', messages.mergeErrors[key])
        );
        expect(onSuccess).not.toHaveBeenCalled();
        expect(result.current.isMerging).toBe(false);
      }
    );
  }

  it('keeps the existing error fallback for older servers and connection failures', async () => {
    post.mockRejectedValueOnce(new Error('Connection lost'));
    const { result } = renderMerge();

    await act(async () => {
      await result.current.handleConfirmMerge();
    });

    expect(toast.error).toHaveBeenCalledWith('Account merge failed: Connection lost');
  });
});
