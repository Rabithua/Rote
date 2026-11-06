import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { publicPost } from '@/utils/api';
import { registerWithPasskey } from '@/utils/passkey';
import { getAuthErrorMessage } from './authErrors';
import type { AuthenticationTokens, RegisterData } from './types';
import {
  createRegisterDataSchema,
  createUsernameDataSchema,
  getZodErrorMessage,
  type LoginSiteStatus,
} from './validation';

type AccountRegistrationOptions = {
  registerData: RegisterData;
  siteStatus: LoginSiteStatus;
  onAuthenticated: (tokens: AuthenticationTokens) => void;
};

export function useAccountRegistration({
  registerData,
  siteStatus,
  onAuthenticated,
}: AccountRegistrationOptions) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.login' });
  const [isRegistering, setIsRegistering] = useState(false);

  async function register(method: 'passkey' | 'password') {
    const schema =
      method === 'passkey'
        ? createUsernameDataSchema(t, siteStatus)
        : createRegisterDataSchema({ t, siteStatus });
    const validation = schema.safeParse(registerData);
    if (!validation.success) {
      toast.error(getZodErrorMessage(validation.error, t('usernameRequired')));
      return;
    }

    setIsRegistering(true);
    try {
      const tokens =
        method === 'passkey'
          ? await registerWithPasskey({ username: registerData.username })
          : (await publicPost('/auth/register', validation.data)).data;
      toast.success(t('messages.registerSuccess'));
      onAuthenticated(tokens);
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'NotAllowedError') {
        toast.info(t('passkey.cancelled'));
      } else {
        toast.error(
          getAuthErrorMessage(
            error,
            t,
            method === 'passkey' ? 'passkey.registerFailed' : 'messages.registerFailed'
          )
        );
      }
    } finally {
      setIsRegistering(false);
    }
  }

  return { isRegistering, register };
}
