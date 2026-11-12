import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { del, post, put } from '@/utils/api';
import { Loader } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// ==========================================
// 1. 修改密码 Dialog
// ==========================================
interface ChangePasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ChangePasswordDialog({
  isOpen,
  onOpenChange,
  onSuccess,
}: ChangePasswordDialogProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile.settings.password' });
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleClose = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const handleConfirm = async () => {
    if (!oldPassword || !newPassword) {
      toast.error(t('passwordRequired'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('passwordsDoNotMatch'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('changeFailed', { error: 'Password must be at least 6 characters' }));
      return;
    }

    try {
      setIsSaving(true);
      await put('/auth/password', {
        oldpassword: oldPassword,
        newpassword: newPassword,
      });
      toast.success(t('changeSuccess'));
      onSuccess();
      handleClose(false);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      toast.error(t('changeFailed', { error: errorMessage }));
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid =
    oldPassword && newPassword && confirmPassword && newPassword === confirmPassword;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('change')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Input
              type="password"
              placeholder={t('passwordPlaceholder')}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('newPasswordLabel')}</label>
            <Input
              type="password"
              placeholder={t('newPasswordPlaceholder')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('confirmNewPasswordLabel')}</label>
            <Input
              type="password"
              placeholder={t('confirmNewPasswordPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSaving}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSaving && isFormValid) {
                  handleConfirm();
                }
              }}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleClose(false)}
              disabled={isSaving}
            >
              {t('cancel')}
            </Button>
            <Button className="flex-1" onClick={handleConfirm} disabled={isSaving || !isFormValid}>
              {isSaving && <Loader className="mr-2 size-4 animate-spin" />}
              {isSaving ? t('saving') : t('confirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 2. 清除密码 Dialog
// ==========================================
interface ClearPasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ClearPasswordDialog({ isOpen, onOpenChange, onSuccess }: ClearPasswordDialogProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile.settings.password' });
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = (open: boolean) => {
    if (!open) setPassword('');
    onOpenChange(open);
  };

  const handleConfirm = async () => {
    try {
      setIsSaving(true);
      await del('/auth/password', {
        data: { password },
      });
      toast.success(t('clearSuccess'));
      onSuccess();
      handleClose(false);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      toast.error(t('clearFailed', { error: errorMessage }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('clearConfirmTitle')}</DialogTitle>
          <DialogDescription>{t('clearWarning')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Input
              type="password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSaving}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSaving && password) {
                  handleConfirm();
                }
              }}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleClose(false)}
              disabled={isSaving}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleConfirm}
              disabled={isSaving || !password}
            >
              {isSaving && <Loader className="mr-2 size-4 animate-spin" />}
              {isSaving ? t('saving') : t('confirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 3. 设置密码 Dialog
// ==========================================
interface SetPasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function SetPasswordDialog({ isOpen, onOpenChange, onSuccess }: SetPasswordDialogProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile.settings.password' });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleClose = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const handleConfirm = async () => {
    if (!newPassword) {
      toast.error(t('passwordRequired'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('passwordsDoNotMatch'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('setFailed', { error: 'Password must be at least 6 characters' }));
      return;
    }

    try {
      setIsSaving(true);
      await post('/auth/password/set', {
        newpassword: newPassword,
      });
      toast.success(t('setSuccess'));
      onSuccess();
      handleClose(false);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      toast.error(t('setFailed', { error: errorMessage }));
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = newPassword && confirmPassword && newPassword === confirmPassword;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('set')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('newPasswordLabel')}</label>
            <Input
              type="password"
              placeholder={t('newPasswordPlaceholder')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('confirmNewPasswordLabel')}</label>
            <Input
              type="password"
              placeholder={t('confirmNewPasswordPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSaving}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSaving && isFormValid) {
                  handleConfirm();
                }
              }}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleClose(false)}
              disabled={isSaving}
            >
              {t('cancel')}
            </Button>
            <Button className="flex-1" onClick={handleConfirm} disabled={isSaving || !isFormValid}>
              {isSaving && <Loader className="mr-2 size-4 animate-spin" />}
              {isSaving ? t('saving') : t('confirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
