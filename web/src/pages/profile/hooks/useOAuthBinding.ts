import { del, get, post } from '@/utils/api';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useSearchParams } from 'react-router-dom';

interface MergeInfo {
  existingUserId: string;
  existingUsername: string;
  existingEmail: string;
  provider: string;
  providerUserId: string;
  providerUsername: string;
}

export function useOAuthBinding(onSuccess?: () => void) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });
  const [searchParams, setSearchParams] = useSearchParams();
  const [bindingProviders, setBindingProviders] = useState<Record<string, boolean>>({});
  const [unbindingProviders, setUnbindingProviders] = useState<Record<string, boolean>>({});
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeInfo, setMergeInfo] = useState<MergeInfo | null>(null);

  const handleBindOAuth = async (provider: string, redirectUrl: string = '/profile/setting') => {
    setBindingProviders((prev) => ({ ...prev, [provider]: true }));
    try {
      const response = await get(
        `/auth/oauth/${provider}/bind?redirect=${encodeURIComponent(redirectUrl)}`
      );
      if (response.data?.redirectUrl) {
        window.location.href = response.data.redirectUrl;
      } else {
        throw new Error(`Failed to get ${provider} authorization URL`);
      }
    } catch (err: any) {
      setBindingProviders((prev) => ({ ...prev, [provider]: false }));
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
      const errorKey = `settings.oauth.${provider}.bindFailed`;
      const fallbackKey = 'settings.oauth.bindFailed';
      toast.error(
        t(errorKey, { error: errorMessage, defaultValue: t(fallbackKey, { error: errorMessage }) })
      );
    }
  };

  const handleUnbindOAuth = async (provider: string) => {
    setUnbindingProviders((prev) => ({ ...prev, [provider]: true }));
    try {
      await del(`/auth/oauth/${provider}/bind`);
      const successKey = `settings.oauth.${provider}.unbindSuccess`;
      const fallbackKey = 'settings.oauth.unbindSuccess';
      toast.success(t(successKey, { defaultValue: t(fallbackKey) }));
      onSuccess?.();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
      const errorKey = `settings.oauth.${provider}.unbindFailed`;
      const fallbackKey = 'settings.oauth.unbindFailed';
      toast.error(
        t(errorKey, { error: errorMessage, defaultValue: t(fallbackKey, { error: errorMessage }) })
      );
    } finally {
      setUnbindingProviders((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const handleConfirmMerge = async () => {
    if (!mergeInfo) return;

    setIsMerging(true);
    try {
      const endpoint = `/auth/oauth/${mergeInfo.provider}/bind/merge`;
      const payload: any = {
        existingUserId: mergeInfo.existingUserId,
        [`${mergeInfo.provider}UserId`]: mergeInfo.providerUserId,
      };
      if (mergeInfo.providerUsername) {
        payload[`${mergeInfo.provider}Username`] = mergeInfo.providerUsername;
      }

      const response = await post(endpoint, payload);

      if (response.data?.merged) {
        const successKey = `settings.oauth.${mergeInfo.provider}.mergeSuccess`;
        const fallbackKey = 'settings.oauth.mergeSuccess';
        toast.success(t(successKey, { defaultValue: t(fallbackKey) }));
        setIsMergeDialogOpen(false);
        setMergeInfo(null);
        onSuccess?.();
        return true;
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
      const errorKey = `settings.oauth.${mergeInfo.provider}.mergeFailed`;
      const fallbackKey = 'settings.oauth.mergeFailed';
      toast.error(
        t(errorKey, { error: errorMessage, defaultValue: t(fallbackKey, { error: errorMessage }) })
      );
    } finally {
      setIsMerging(false);
    }
    return false;
  };

  const handleCancelMerge = () => {
    setIsMergeDialogOpen(false);
    setMergeInfo(null);
  };

  const handleOAuthCallback = () => {
    const oauthStatus = searchParams.get('oauth');
    const bindStatus = searchParams.get('bind');
    const errorMessage = searchParams.get('message');
    const merged = searchParams.get('merged');
    const provider = searchParams.get('provider') || 'github';
    const existingUserId = searchParams.get('existingUserId');
    const existingUsername = searchParams.get('existingUsername');
    const existingEmail = searchParams.get('existingEmail');
    const providerUserId = searchParams.get(`${provider}UserId`);
    const providerUsername = searchParams.get(`${provider}Username`);

    if (oauthStatus === 'bind') {
      if (bindStatus === 'success') {
        if (merged === 'true') {
          const successKey = `settings.oauth.${provider}.mergeSuccess`;
          const fallbackKey = 'settings.oauth.mergeSuccess';
          toast.success(t(successKey, { defaultValue: t(fallbackKey) }));
        } else {
          const successKey = `settings.oauth.${provider}.bindSuccess`;
          const fallbackKey = 'settings.oauth.bindSuccess';
          toast.success(t(successKey, { defaultValue: t(fallbackKey) }));
        }
        onSuccess?.();
        setSearchParams({}, { replace: true });
      } else if (bindStatus === 'merge_required') {
        if (existingUserId && providerUserId) {
          setMergeInfo({
            existingUserId,
            existingUsername: existingUsername || '',
            existingEmail: existingEmail || '',
            provider,
            providerUserId,
            providerUsername: providerUsername || '',
          });
          setIsMergeDialogOpen(true);
          setSearchParams({}, { replace: true });
        }
      } else if (bindStatus === 'error' && errorMessage) {
        const errorKey = `settings.oauth.${provider}.bindFailed`;
        const fallbackKey = 'settings.oauth.bindFailed';
        toast.error(
          t(errorKey, {
            error: decodeURIComponent(errorMessage),
            defaultValue: t(fallbackKey, { error: decodeURIComponent(errorMessage) }),
          })
        );
        setSearchParams({}, { replace: true });
      }
    }
  };

  return {
    bindingProviders,
    unbindingProviders,
    isMergeDialogOpen,
    setIsMergeDialogOpen,
    isMerging,
    mergeInfo,
    setMergeInfo,
    handleBindOAuth,
    handleUnbindOAuth,
    handleConfirmMerge,
    handleCancelMerge,
    handleOAuthCallback,
  };
}
