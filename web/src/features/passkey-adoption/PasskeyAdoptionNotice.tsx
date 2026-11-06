import { useSiteStatus } from '@/hooks/useSiteStatus';
import { authService } from '@/utils/auth';
import { useAPIGet } from '@/utils/fetcher';
import { isPasskeySupported, listPasskeys, registerPasskey } from '@/utils/passkey';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  consumePasskeyAdoptionIntent,
  markPasskeyAdoptionOffered,
  readPasskeyAdoptionIntent,
  shouldOfferPasskeyAdoption,
} from './intent';

export function PasskeyAdoptionNotice({
  accountId,
  active = true,
}: {
  accountId?: string;
  active?: boolean;
}) {
  const { t } = useTranslation('translation');
  const { data: siteStatus } = useSiteStatus();
  const [intent] = useState(readPasskeyAdoptionIntent);
  const [supported] = useState(isPasskeySupported);
  const isIntendedAccount = active && accountId && intent?.accountId === accountId;
  const eligible =
    isIntendedAccount &&
    supported &&
    siteStatus &&
    siteStatus.passkey?.enabled !== false &&
    shouldOfferPasskeyAdoption(accountId);
  const {
    data: passkeys,
    error,
    isValidating,
  } = useAPIGet<readonly { id: string }[]>(
    eligible ? ['passkey-adoption', accountId] : null,
    listPasskeys,
    { revalidateOnFocus: false, revalidateOnMount: true, shouldRetryOnError: false }
  );

  useEffect(() => {
    if (!isIntendedAccount || !siteStatus) return;
    if (!eligible) {
      consumePasskeyAdoptionIntent(accountId);
      return;
    }
    if (isValidating || (!passkeys && !error)) return;
    if (!consumePasskeyAdoptionIntent(accountId)) return;
    // This optional suggestion requires a successful eligibility read. A failed
    // lookup must not affect the OAuth session or interrupt the user's destination.
    if (error || passkeys?.length !== 0) return;
    markPasskeyAdoptionOffered(accountId);
    toast(t('pages.passkeyAdoption.title'), {
      id: `passkey-adoption:${accountId}`,
      description: t('pages.passkeyAdoption.description'),
      duration: 15000,
      className:
        'max-sm:!grid max-sm:!grid-cols-[minmax(0,1fr)_minmax(0,2fr)] max-sm:!gap-x-2 max-sm:!gap-y-3',
      classNames: {
        content: 'max-sm:col-span-2 max-sm:min-w-0',
        cancelButton: 'max-sm:!m-0 max-sm:!justify-center',
        actionButton: 'max-sm:!m-0 max-sm:!justify-center',
      },
      action: {
        label: t('pages.passkeyAdoption.create'),
        onClick: async () => {
          const token = authService.getAccessToken();
          if (!token || authService.getUserInfoFromToken(token)?.userId !== accountId) return;
          const isCurrentAccount = () => {
            const currentToken = authService.getAccessToken();
            return (
              currentToken !== null &&
              authService.getUserInfoFromToken(currentToken)?.userId === accountId
            );
          };
          const toastId = toast.loading(t('pages.passkeyAdoption.creating'));
          try {
            await registerPasskey();
            if (isCurrentAccount()) {
              toast.success(t('pages.login.passkey.registerSuccess'), { id: toastId });
            } else {
              toast.dismiss(toastId);
            }
          } catch (registrationError) {
            if (!isCurrentAccount()) {
              toast.dismiss(toastId);
            } else if (
              (registrationError as { name?: string } | null)?.name === 'NotAllowedError'
            ) {
              toast.info(t('pages.login.passkey.cancelled'), { id: toastId });
            } else {
              toast.error(t('pages.login.passkey.registerFailed'), { id: toastId });
            }
          }
        },
      },
      cancel: { label: t('pages.passkeyAdoption.later'), onClick: () => undefined },
    });
  }, [accountId, eligible, error, isIntendedAccount, isValidating, passkeys, siteStatus, t]);

  return null;
}
