import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  registerPasskey as registerPasskeyUtil,
  authenticateWithPasskey as authenticateWithPasskeyUtil,
  listPasskeys as listPasskeysUtil,
  deletePasskey as deletePasskeyUtil,
} from '@/utils/passkey';
import { authService } from '@/utils/auth';

interface PasskeyItem {
  id: string;
  deviceName: string;
  credentialId: string;
  transports: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export function usePasskey() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages' });
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPasskeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listPasskeysUtil();
      setPasskeys(data || []);
    } catch (error: any) {
      toast.error(error?.message || t('settings.passkey.fetchFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const registerPasskey = useCallback(async () => {
    setIsRegistering(true);
    try {
      await registerPasskeyUtil();
      toast.success(t('login.passkey.registerSuccess'));
      await fetchPasskeys();
      return true;
    } catch (error: any) {
      if (error?.name === 'AbortError' && error?.message === 'passkey_account_changed') {
        toast.error(t('login.passkey.accountChanged'));
      } else if (error?.name === 'NotAllowedError') {
        toast.info(t('login.passkey.cancelled'));
      } else {
        toast.error(error?.message || t('login.passkey.registerFailed'));
      }
      return false;
    } finally {
      setIsRegistering(false);
    }
  }, [t, fetchPasskeys]);

  const authenticateWithPasskey = useCallback(async () => {
    setIsAuthenticating(true);
    try {
      const result = await authenticateWithPasskeyUtil();
      authService.setTokens(result.accessToken, result.refreshToken);
      toast.success(t('login.passkey.loginSuccess'));
      return result;
    } catch (error: any) {
      if (error?.name === 'NotAllowedError') {
        toast.info(t('login.passkey.cancelled'));
      } else {
        toast.error(error?.message || t('login.passkey.loginFailed'));
      }
      return null;
    } finally {
      setIsAuthenticating(false);
    }
  }, [t]);

  const deletePasskey = useCallback(
    async (id: string) => {
      try {
        await deletePasskeyUtil(id);
        toast.success(t('profile.settings.passkey.deleteSuccess'));
        await fetchPasskeys();
      } catch (error: any) {
        toast.error(error?.message || t('profile.settings.passkey.deleteFailed'));
      }
    },
    [t, fetchPasskeys]
  );

  return {
    isRegistering,
    isAuthenticating,
    passkeys,
    isLoading,
    registerPasskey,
    authenticateWithPasskey,
    fetchPasskeys,
    deletePasskey,
  };
}
