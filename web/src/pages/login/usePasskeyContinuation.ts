import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { continueWithPasskey } from '@/utils/passkey';
import { getAuthErrorMessage } from './authErrors';
import type { AuthenticationTokens } from './types';
import { createPasskeyContinuationSchema, getZodErrorMessage } from './validation';

type PasskeyContinuationOptions = {
  username: string;
  onAuthenticated: (tokens: AuthenticationTokens) => void;
};

export function usePasskeyContinuation({ username, onAuthenticated }: PasskeyContinuationOptions) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.login' });
  const [isContinuing, setIsContinuing] = useState(false);

  async function continueWithUsername() {
    const validation = createPasskeyContinuationSchema(t).safeParse({ username });
    if (!validation.success) {
      toast.error(getZodErrorMessage(validation.error, t('usernameRequired')));
      return;
    }
    setIsContinuing(true);
    try {
      const tokens = await continueWithPasskey(validation.data);
      toast.success(t('messages.loginSuccess'));
      onAuthenticated(tokens);
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'NotAllowedError') {
        toast.info(t('passkey.cancelled'));
      } else {
        toast.error(getAuthErrorMessage(error, t, 'passkey.loginFailed'));
      }
    } finally {
      setIsContinuing(false);
    }
  }

  return { isContinuing, continueWithUsername };
}
