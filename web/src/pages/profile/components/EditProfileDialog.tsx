import UserAvatar from '@/components/others/UserAvatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Profile } from '@/types/main';
import { Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EditProfileDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editProfile: Partial<Profile>;
  onProfileChange: (profile: Partial<Profile>) => void;
  onSave: () => void;
  isSaving: boolean;
  canUpload: boolean;
  inputAvatarRef: React.RefObject<HTMLInputElement | null>;
  onAvatarClick: () => void;
}

export default function EditProfileDialog({
  isOpen,
  onOpenChange,
  editProfile,
  onProfileChange,
  onSave,
  isSaving,
  canUpload,
  inputAvatarRef,
  onAvatarClick,
}: EditProfileDialogProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editProfile')}</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[70dvh] w-full cursor-default gap-5 overflow-y-scroll">
          <div className="flex w-full flex-col gap-1">
            <input
              type="file"
              accept="image/*"
              max="1"
              className="hidden"
              ref={inputAvatarRef}
              disabled={!canUpload}
              title="Upload avatar image"
            />
            <UserAvatar
              avatar={editProfile?.avatar}
              className="text-primary mx-auto my-2 block size-20 shrink-0 cursor-pointer bg-[#00000010]"
              fallbackClassName="bg-muted/80"
              onClick={onAvatarClick}
            />
            <div className="mt-2 text-base font-semibold">{t('email')}</div>
            <Input
              disabled
              className="w-full rounded-md font-mono"
              maxLength={20}
              value={editProfile?.email || ''}
            />
            <div className="mt-2 text-base font-semibold">{t('username')}</div>
            <Input
              disabled
              className="w-full rounded-md font-mono"
              maxLength={20}
              value={editProfile?.username || ''}
            />
            <div className="mt-2 text-base font-semibold">{t('nickname')}</div>
            <Input
              placeholder={t('enterNickname')}
              className="w-full rounded-md font-mono"
              maxLength={20}
              value={editProfile?.nickname || ''}
              onInput={(e: React.FormEvent<HTMLInputElement>) => {
                onProfileChange({
                  ...editProfile,
                  nickname: (e.target as HTMLInputElement).value,
                });
              }}
            />
            <div className="mt-2 text-base font-semibold">{t('description')}</div>
            <Textarea
              placeholder={t('enterDescription')}
              className="w-full rounded-md"
              maxLength={300}
              value={editProfile?.description || ''}
              style={{ height: 120, resize: 'none' }}
              onInput={(e: React.FormEvent<HTMLTextAreaElement>) => {
                onProfileChange({
                  ...editProfile,
                  description: (e.target as HTMLTextAreaElement).value,
                });
              }}
            />
            <Button
              className={`mt-4 flex w-full items-center justify-center`}
              onClick={() => {
                if (!isSaving) {
                  onSave();
                }
              }}
            >
              {isSaving && <Loader className="mr-2 size-4 animate-spin" />}
              {isSaving ? t('editing') : t('save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
