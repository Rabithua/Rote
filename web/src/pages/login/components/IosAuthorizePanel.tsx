import { AppleIcon } from '@/components/icons/Apple';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import type { LoginProfile } from '../types';

type IosAuthorizePanelProps = {
  profile: LoginProfile;
  onAuthorize: () => void;
  onSwitchAccount: () => void;
};

export function IosAuthorizePanel({
  profile,
  onAuthorize,
  onSwitchAccount,
}: IosAuthorizePanelProps) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'pages.login',
  });

  return (
    <div className="w-full">
      <h2 className="mb-4 flex items-center gap-2 text-lg">
        <AppleIcon className="size-4" aria-hidden="true" />
        {t('authorize.title')}
      </h2>
      <p className="mb-6 text-sm font-light [overflow-wrap:anywhere]">
        {t('authorize.message', {
          username: profile.nickname || profile.username,
        })}
      </p>
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onSwitchAccount}
          className="h-auto min-w-0 flex-1 whitespace-normal"
          aria-label={t('authorize.switchAccount')}
        >
          {t('authorize.switchAction')}
        </Button>
        <Button
          onClick={onAuthorize}
          className="h-auto min-w-0 flex-[2] whitespace-normal"
          aria-label={t('authorize.button')}
        >
          {t('authorize.confirmAction')}
        </Button>
      </div>
    </div>
  );
}
