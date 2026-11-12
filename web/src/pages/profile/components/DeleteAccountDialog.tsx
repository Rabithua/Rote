import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type DeleteConfirmMethod = 'password' | 'oauth' | 'passkey' | 'mock';

interface DeleteAccountDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  hasPassword: boolean;
  oauthProviders: string[];
  hasPasskey: boolean;
  showMockOption: boolean;
  isDeleting: boolean;
  deletingMethod: DeleteConfirmMethod | null;
  onConfirmPassword: (password: string) => void;
  onConfirmOAuth: (provider: string) => void;
  onConfirmPasskey: () => void;
  onConfirmMock: () => void;
  onCancel: () => void;
}

function providerLabel(provider: string) {
  if (provider === 'github') return 'GitHub';
  if (provider === 'apple') return 'Apple';
  return provider;
}

export default function DeleteAccountDialog({
  isOpen,
  onOpenChange,
  hasPassword,
  oauthProviders,
  hasPasskey,
  showMockOption,
  isDeleting,
  deletingMethod,
  onConfirmPassword,
  onConfirmOAuth,
  onConfirmPasskey,
  onConfirmMock,
  onCancel,
}: DeleteAccountDialogProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });
  const [password, setPassword] = useState('');

  const isMethodBusy = (method: DeleteConfirmMethod) => isDeleting && deletingMethod === method;
  const anyBusy = isDeleting;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settings.deleteAccount.confirmTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">{t('settings.deleteAccount.warning')}</p>
          {hasPassword ? (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">
                {t('settings.deleteAccount.passwordLabel')}
              </label>
              <Input
                type="password"
                placeholder={t('settings.deleteAccount.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={anyBusy}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !anyBusy && password) {
                    onConfirmPassword(password);
                  }
                }}
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onCancel} disabled={anyBusy}>
                  {t('settings.deleteAccount.cancel')}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => onConfirmPassword(password)}
                  disabled={anyBusy || !password}
                >
                  {isMethodBusy('password') && <Loader className="mr-2 size-4 animate-spin" />}
                  {isMethodBusy('password')
                    ? t('settings.deleteAccount.deleting')
                    : t('settings.deleteAccount.confirm')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{t('settings.deleteAccount.reauthHint')}</p>
              {oauthProviders.length === 0 && !hasPasskey && (
                <p className="text-muted-foreground text-sm">
                  {t('settings.deleteAccount.reauthNoneHint')}
                </p>
              )}
              {oauthProviders.map((provider) => (
                <Button
                  key={provider}
                  variant="destructive"
                  className="w-full"
                  onClick={() => onConfirmOAuth(provider)}
                  disabled={anyBusy}
                >
                  {isMethodBusy('oauth') && deletingMethod === 'oauth' && (
                    <Loader className="mr-2 size-4 animate-spin" />
                  )}
                  {t('settings.deleteAccount.verifyWithProvider', {
                    provider: providerLabel(provider),
                  })}
                </Button>
              ))}
              {hasPasskey && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={onConfirmPasskey}
                  disabled={anyBusy}
                >
                  {isMethodBusy('passkey') && <Loader className="mr-2 size-4 animate-spin" />}
                  {t('settings.deleteAccount.verifyWithPasskey')}
                </Button>
              )}
              {showMockOption && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onConfirmMock}
                  disabled={anyBusy}
                >
                  {isMethodBusy('mock') && <Loader className="mr-2 size-4 animate-spin" />}
                  {t('settings.deleteAccount.verifyWithMock')}
                </Button>
              )}
              <Button variant="outline" className="w-full" onClick={onCancel} disabled={anyBusy}>
                {t('settings.deleteAccount.cancel')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
