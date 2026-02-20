import defaultCover from '@/assets/img/defaultCover.png';
import { VerifiedIcon } from '@/components/icons/Verified';
import UserAvatar from '@/components/others/UserAvatar';
import { Button } from '@/components/ui/button';
import type { Profile } from '@/types/main';
import Linkify from 'linkify-react';
import { Edit, LoaderPinwheel, Settings2 } from 'lucide-react';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

interface ProfileHeaderProps {
  profile: Profile;
  canUpload: boolean;
  coverChangeing: boolean;
  inputCoverRef: React.RefObject<HTMLInputElement | null>;
  inputAvatarRef: React.RefObject<HTMLInputElement | null>;
  onChangeCover: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenEditProfile: () => void;
}

export default function ProfileHeader({
  profile,
  canUpload,
  coverChangeing,
  inputCoverRef,
  inputAvatarRef,
  onChangeCover,
  onOpenEditProfile,
}: ProfileHeaderProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });

  return (
    <div className="pb-4">
      <div className="relative aspect-[3] w-full overflow-hidden">
        <img className="h-full w-full object-cover" src={profile?.cover || defaultCover} alt="" />
        <input
          type="file"
          accept="image/*"
          max="1"
          className="hidden"
          ref={inputCoverRef}
          onChange={onChangeCover}
          disabled={coverChangeing || !canUpload}
          title="Upload cover image"
        />
        <button
          title="Upload cover image"
          type="button"
          className={`absolute right-3 bottom-1 rounded-md bg-[#00000030] px-2 py-1 text-white backdrop-blur-xl ${
            canUpload ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
          }`}
          disabled={!canUpload}
          onClick={() => {
            if (!canUpload) return;
            inputCoverRef.current?.click();
          }}
        >
          <LoaderPinwheel className={`size-4 ${coverChangeing && 'animate-spin'}`} />
        </button>
      </div>
      <div className="mx-4 flex h-16 items-center">
        <UserAvatar
          avatar={profile?.avatar}
          className="text-primary size-20 shrink-0 translate-y-[-50%] cursor-pointer border-4 sm:block"
          fallbackClassName="bg-muted/80"
          onClick={() => {
            if (!canUpload) return;
            (inputAvatarRef.current as HTMLInputElement | null)?.click();
          }}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" asChild>
            <Link to="/profile/setting">
              <Settings2 className="size-4" />
            </Link>
          </Button>
          <Button onClick={onOpenEditProfile}>
            <Edit className="size-4" />
            {t('editProfile')}
          </Button>
        </div>
      </div>
      <div className="mx-4 flex flex-col gap-1">
        <Link className="w-fit" to={`/${profile?.username}`}>
          <h1 className="inline-flex w-fit items-center gap-1 text-2xl font-semibold hover:underline">
            {profile?.nickname}
            {profile?.emailVerified && <VerifiedIcon className="text-theme size-5 shrink-0" />}
          </h1>
          <h2 className="text-info w-fit text-base hover:underline">@{profile?.username}</h2>
        </Link>
        <div className="text-base">
          <div className="aTagStyle wrap-break-word whitespace-pre-line">
            <Linkify>{(profile?.description as any) || t('noDescription')}</Linkify>
          </div>
        </div>
        <div className="text-info text-base">
          {t('registerTime')}
          {moment(profile?.createdAt).local().format('YYYY/MM/DD HH:mm:ss')}
        </div>
      </div>
    </div>
  );
}
