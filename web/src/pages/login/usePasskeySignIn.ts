import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { authenticateWithPasskey } from '@/utils/passkey';
import { getAuthErrorMessage } from './authErrors';
import type { AuthenticationTokens } from './types';

type PasskeySignInOptions = {
  onAuthenticated: (tokens: AuthenticationTokens) => void;
};

export function usePasskeySignIn({ onAuthenticated }: PasskeySignInOptions) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.login' });
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  async function authenticate() {
    setIsAuthenticating(true);
    try {
      const tokens = await authenticateWithPasskey();
      toast.success(t('passkey.loginSuccess'));
      onAuthenticated(tokens);
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'NotAllowedError') {
        toast.info(t('passkey.cancelled'));
      } else {
        toast.error(getAuthErrorMessage(error, t, 'passkey.loginFailed'));
      }
    } finally {
      setIsAuthenticating(false);
    }
  }

  return { isAuthenticating, authenticate };
}
