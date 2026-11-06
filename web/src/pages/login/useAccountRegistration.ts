import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { publicPost } from '@/utils/api';
import { getAuthErrorMessage } from './authErrors';
import type { AuthenticationTokens, RegisterData } from './types';
import { createRegisterDataSchema, getZodErrorMessage, type LoginSiteStatus } from './validation';

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

  async function register() {
    const schema = createRegisterDataSchema({ t, siteStatus });
    const validation = schema.safeParse(registerData);
    if (!validation.success) {
      toast.error(getZodErrorMessage(validation.error, t('usernameRequired')));
      return;
    }

    setIsRegistering(true);
    try {
      const tokens = (await publicPost('/auth/register', validation.data)).data;
      toast.success(t('messages.registerSuccess'));
      onAuthenticated(tokens);
    } catch (error) {
      toast.error(getAuthErrorMessage(error, t, 'messages.registerFailed'));
    } finally {
      setIsRegistering(false);
    }
  }

  return { isRegistering, register };
}
