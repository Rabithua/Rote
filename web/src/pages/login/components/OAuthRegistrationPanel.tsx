import Logo from '@/components/others/logo';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import { Button } from '@/components/ui/button';
import { publicGet, publicPost } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getAuthErrorMessage } from '../authErrors';
import type { AuthenticationTokens } from '../types';
import { createUsernameDataSchema, getZodErrorMessage, type LoginSiteStatus } from '../validation';
import { UsernameRegistrationForm } from './UsernameRegistrationForm';

type OAuthRegistrationDetails = {
  provider: string;
  suggestedUsername: string;
};

type OAuthRegistrationPanelProps = {
  registrationToken: string;
  siteStatus: LoginSiteStatus;
  onBack: () => void;
  onComplete: (tokens: AuthenticationTokens, completionUrl: string) => void;
};

function OAuthUsernameConfirmation({
  registrationToken,
  details,
  siteStatus,
  onBack,
  onComplete,
}: OAuthRegistrationPanelProps & { details: OAuthRegistrationDetails }) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.login' });
  const [username, setUsername] = useState(details.suggestedUsername);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function completeRegistration() {
    const validation = createUsernameDataSchema(t, siteStatus).safeParse({ username });
    if (!validation.success) {
      toast.error(getZodErrorMessage(validation.error, t('usernameRequired')));
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await publicPost('/auth/register/oauth', { registrationToken, username });
      toast.success(t('messages.registerSuccess'));
      onComplete(data, data.completionUrl);
    } catch (error) {
      toast.error(getAuthErrorMessage(error, t, 'errors.oauthRegistrationFailed'));
      setIsSubmitting(false);
    }
  }

  const provider =
    details.provider === 'github'
      ? 'GitHub'
      : details.provider === 'apple'
        ? 'Apple'
        : details.provider;

  return (
    <>
      <div className="mb-6 space-y-2">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {t('entry.oauthCreateTitle')}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t('entry.oauthCreateDescription', { provider })}
        </p>
      </div>
      <UsernameRegistrationForm
        username={username}
        disabled={isSubmitting}
        submitLabel={t('entry.createAccount')}
        onUsernameChange={setUsername}
        onSubmit={completeRegistration}
        onBack={onBack}
      />
    </>
  );
}

export function OAuthRegistrationPanel(props: OAuthRegistrationPanelProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.login' });
  const { data, error, isLoading } = useAPIGet<OAuthRegistrationDetails>(
    `/auth/register/oauth/${props.registrationToken}`,
    () =>
      publicGet(`/auth/register/oauth/${encodeURIComponent(props.registrationToken)}`).then(
        (response) => response.data
      ),
    {
      shouldRetryOnError: false,
      revalidateOnFocus: false,
      onError: (requestError) =>
        toast.error(getAuthErrorMessage(requestError, t, 'errors.oauthRegistrationFailed')),
    }
  );

  return (
    <>
      <Logo className="mb-5 w-28" color="#3ECF4A" />
      {isLoading ? (
        <LoadingPlaceholder className="py-8" size={6} />
      ) : data && !error ? (
        <OAuthUsernameConfirmation key={props.registrationToken} {...props} details={data} />
      ) : (
        <Button variant="outline" className="w-full" onClick={props.onBack}>
          {t('entry.backToLogin')}
        </Button>
      )}
    </>
  );
}
