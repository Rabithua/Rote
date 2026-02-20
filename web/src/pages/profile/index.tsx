import NavBar from '@/components/layout/navBar';
import { useSiteStatus } from '@/hooks/useSiteStatus';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import {
  loadProfileAtom,
  loadUserSettingsAtom,
  patchProfileAtom,
  profileAtom,
} from '@/state/profile';
import type { OpenKeys, Profile } from '@/types/main';
import { get, post } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { isHeicFile } from '@/utils/uploadHelpers';
import { useAtomValue, useSetAtom } from 'jotai';
import { ScanFace, Stars } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Area } from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import AvatarCropDialog from './components/AvatarCropDialog';
import EditProfileDialog from './components/EditProfileDialog';
import OpenKeySection from './components/OpenKeySection';
import ProfileHeader from './components/ProfileHeader';
import ProfileSidebar from './components/ProfileSidebar';
import { createCroppedImage, uploadAvatar, uploadCover } from './utils/avatarUpload';

function ProfilePage() {
  const { data: siteStatus } = useSiteStatus();
  const canUpload =
    !!siteStatus?.storage?.r2Configured && siteStatus?.ui?.allowUploadFile !== false;
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });
  const { t: tLogin } = useTranslation('translation', { keyPrefix: 'pages.login' });
  const inputAvatarRef = useRef<HTMLInputElement>(null);
  const inputCoverRef = useRef<HTMLInputElement>(null);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState<boolean>(false);
  const [coverChangeing, setCoverChangeing] = useState(false);

  // 使用 Jotai 托管 profile 与 user settings
  const profile = useAtomValue(profileAtom);
  const loadProfile = useSetAtom(loadProfileAtom);
  const loadUserSettings = useSetAtom(loadUserSettingsAtom);
  const patchProfile = useSetAtom(patchProfileAtom);

  useEffect(() => {
    if (!profile) {
      loadProfile();
    }
    loadUserSettings();
  }, [profile, loadProfile, loadUserSettings]);

  const {
    data: openKeys,
    mutate: mutateOpenKeys,
    isLoading: openKeyLoading,
  } = useAPIGet<OpenKeys>('openKeys', () => get('/api-keys').then((res) => res.data));

  const [editProfile, setEditProfile] = useState<Partial<Profile>>(profile ?? {});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);

  useEffect(() => {
    if (profile) {
      setEditProfile(profile);
    }
  }, [profile]);

  function generateOpenKeyFun() {
    const toastId = toast.loading(t('creating'));
    post('/api-keys')
      .then(() => {
        mutateOpenKeys();
        toast.success(t('createSuccess'), {
          id: toastId,
        });
      })
      .catch(() => {
        toast.error(t('createFailed'), {
          id: toastId,
        });
      });
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!canUpload) return;
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (isHeicFile(selectedFile)) {
      toast.error(t('heicNotSupported'));
      event.target.value = '';
      return;
    }

    setAvatarFile(selectedFile);
    setIsAvatarModalOpen(true);
  }

  async function handleAvatarSave(croppedAreaPixels: Area) {
    if (!avatarFile) {
      toast.error(t('cropError'));
      return;
    }

    try {
      setAvatarUploading(true);
      const croppedImage = await createCroppedImage(avatarFile, croppedAreaPixels);
      const avatarUrl = await uploadAvatar(croppedImage);

      setEditProfile({
        ...editProfile,
        avatar: avatarUrl,
      });
      setAvatarUploading(false);
      setIsAvatarModalOpen(false);
      setAvatarFile(null);
      toast.success(t('uploadSuccess'));
    } catch (_error: any) {
      toast.error(t('uploadFailed'));
      setAvatarUploading(false);
    }
  }

  function saveProfile() {
    if (!profile || !editProfile) return;

    if (editProfile.username !== undefined && editProfile.username !== profile.username) {
      const usernameSchema = z
        .string()
        .min(1, tLogin('usernameRequired'))
        .max(20, tLogin('usernameMaxLength'))
        .regex(/^[A-Za-z0-9_-]+$/, tLogin('usernameFormat'))
        .refine((value) => !siteStatus?.frontendConfig?.safeRoutes?.includes(value), {
          message: tLogin('usernameConflict'),
        });

      const validationResult = usernameSchema.safeParse(editProfile.username);
      if (!validationResult.success) {
        const errorMessage = validationResult.error.issues[0]?.message || t('editFailed');
        toast.error(errorMessage);
        setProfileEditing(false);
        return;
      }
    }

    setProfileEditing(true);
    patchProfile(editProfile as Partial<NonNullable<Profile>>)
      .then(() => {
        toast.success(t('editSuccess'));
        setIsModalOpen(false);
        setProfileEditing(false);
      })
      .catch((error: any) => {
        const errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          error?.response?.data?.error ||
          t('editFailed');

        if (
          errorMessage.includes('username') ||
          errorMessage.includes('Username') ||
          errorMessage.includes('already exists')
        ) {
          toast.error(tLogin('usernameConflict') || errorMessage);
        } else {
          toast.error(errorMessage);
        }
        setIsModalOpen(false);
        setProfileEditing(false);
      });
  }

  async function changeCover(event: React.ChangeEvent<HTMLInputElement>) {
    if (!canUpload) return;
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (isHeicFile(selectedFile)) {
      toast.error(t('heicNotSupported'));
      event.target.value = '';
      return;
    }

    setCoverChangeing(true);
    try {
      const coverUrl = await uploadCover(selectedFile);
      await patchProfile({
        cover: coverUrl,
      });
      setCoverChangeing(false);
    } catch (_error: any) {
      setCoverChangeing(false);
      toast.error(t('uploadFailed'));
    }
  }

  if (!profile) {
    return null;
  }

  return (
    <ContainerWithSideBar
      sidebar={<ProfileSidebar />}
      sidebarHeader={
        <div className="flex items-center gap-2 p-3 text-lg font-semibold">
          <div className="flex items-center gap-2">
            <Stars className="size-5" />
            {t('sideBarTitle')}
          </div>
        </div>
      }
    >
      <div className="flex flex-col divide-y pb-20">
        <NavBar title={t('title')} icon={<ScanFace className="size-6" />} />
        <ProfileHeader
          profile={profile}
          canUpload={canUpload}
          coverChangeing={coverChangeing}
          inputCoverRef={inputCoverRef}
          inputAvatarRef={inputAvatarRef}
          onChangeCover={changeCover}
          onOpenEditProfile={() => setIsModalOpen(true)}
        />

        <OpenKeySection
          openKeys={openKeys}
          isLoading={openKeyLoading}
          onCreateOpenKey={generateOpenKeyFun}
          onMutate={mutateOpenKeys}
        />

        <EditProfileDialog
          isOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
          editProfile={editProfile}
          onProfileChange={setEditProfile}
          onSave={saveProfile}
          isSaving={profileEditing}
          canUpload={canUpload}
          inputAvatarRef={inputAvatarRef}
          onAvatarClick={() => {
            if (!canUpload) return;
            (inputAvatarRef.current as HTMLInputElement | null)?.click();
          }}
          onFileChange={handleFileChange}
        />

        <input
          type="file"
          accept="image/*"
          max="1"
          className="hidden"
          ref={inputAvatarRef}
          onChange={handleFileChange}
          disabled={!canUpload}
          title="Upload avatar image"
        />

        <AvatarCropDialog
          isOpen={isAvatarModalOpen}
          onOpenChange={setIsAvatarModalOpen}
          imageFile={avatarFile}
          onSave={handleAvatarSave}
          isUploading={avatarUploading}
        />
      </div>
    </ContainerWithSideBar>
  );
}

export default ProfilePage;
