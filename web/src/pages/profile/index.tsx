import NavBar from '@/components/layout/navBar';
import {
  parseResourcePreviewScenario,
  RESOURCE_PREVIEW_STATES,
} from '@/features/resources/preview';
import { isOfficialApiOrigin, useResourceState } from '@/features/resources/useResourceState';
import { useSiteStatus } from '@/hooks/useSiteStatus';
import { usePermissions } from '@/hooks/usePermissions';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import {
  loadProfileAtom,
  loadUserSettingsAtom,
  patchProfileAtom,
  profileAtom,
} from '@/state/profile';
import type { Attachment, OpenKeys, Profile } from '@/types/main';
import { get, post } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { isHeicFile } from '@/utils/uploadHelpers';
import { useAtomValue, useSetAtom } from 'jotai';
import { ScanFace, Stars } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Area } from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import AvatarCropDialog from './components/AvatarCropDialog';
import EditProfileDialog from './components/EditProfileDialog';
import OpenKeySection from './components/OpenKeySection';
import ProfileHeader from './components/ProfileHeader';
import ProfileSidebar from './components/ProfileSidebar';
import { getUploadErrorMessage } from '@/utils/directUpload';
import {
  createCroppedImage,
  deletePendingProfileAttachment,
  profileAttachmentUrl,
  uploadAvatar,
  uploadCover,
} from './utils/avatarUpload';

async function deletePendingAttachmentQuietly(attachmentId: string) {
  try {
    await deletePendingProfileAttachment(attachmentId);
  } catch (error) {
    // The server's seven-day orphan cleanup is the durable fallback.
    // eslint-disable-next-line no-console
    console.warn(
      '[profile] pending attachment cleanup failed',
      error instanceof Error ? error.name : 'unknown'
    );
  }
}

function ProfilePage() {
  const { data: siteStatus } = useSiteStatus();
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });
  const { t: tLogin } = useTranslation('translation', { keyPrefix: 'pages.login' });
  const [searchParams] = useSearchParams();
  const inputAvatarRef = useRef<HTMLInputElement>(null);
  const inputCoverRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  const profileEditorSessionRef = useRef(0);
  const avatarUploadGenerationRef = useRef(0);
  const coverUploadGenerationRef = useRef(0);
  const pendingAvatarAttachmentRef = useRef<Attachment | null>(null);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState<boolean>(false);
  const [coverChangeing, setCoverChangeing] = useState(false);

  // 使用 Jotai 托管 profile 与 user settings
  const profile = useAtomValue(profileAtom);
  const previewScenario = import.meta.env.DEV
    ? parseResourcePreviewScenario(searchParams.get('officialResourcesPreview'))
    : null;
  const showOfficialResources = isOfficialApiOrigin() || previewScenario !== null;
  const { capabilities } = usePermissions();
  const canUpload =
    !!siteStatus?.storage?.r2Configured &&
    siteStatus?.ui?.allowUploadFile !== false &&
    capabilities?.['attachment.upload'].allowed === true;
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
  const { data: resourceState, mutate: mutateResourceState } = useResourceState(
    Boolean(profile) && showOfficialResources && previewScenario === null
  );
  const displayedResourceState = previewScenario
    ? RESOURCE_PREVIEW_STATES[previewScenario]
    : resourceState;

  const [editProfile, setEditProfile] = useState<Partial<Profile>>(profile ?? {});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [pendingAvatarAttachment, setPendingAvatarAttachment] = useState<Attachment | null>(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);

  useEffect(() => {
    if (profile) {
      setEditProfile(profile);
    }
  }, [profile]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      avatarUploadGenerationRef.current += 1;
      coverUploadGenerationRef.current += 1;
      const pending = pendingAvatarAttachmentRef.current;
      pendingAvatarAttachmentRef.current = null;
      if (pending) void deletePendingAttachmentQuietly(pending.id);
    };
  }, []);

  async function discardPendingAvatarAttachment() {
    const pending = pendingAvatarAttachmentRef.current;
    pendingAvatarAttachmentRef.current = null;
    if (isMountedRef.current) setPendingAvatarAttachment(null);
    if (pending) await deletePendingAttachmentQuietly(pending.id);
  }

  async function acceptPendingAvatarAttachment(
    attachment: Attachment,
    session: number,
    generation: number
  ): Promise<boolean> {
    if (
      !isMountedRef.current ||
      session !== profileEditorSessionRef.current ||
      generation !== avatarUploadGenerationRef.current
    ) {
      await deletePendingAttachmentQuietly(attachment.id);
      return false;
    }
    const previous = pendingAvatarAttachmentRef.current;
    if (previous && previous.id !== attachment.id) {
      await deletePendingAttachmentQuietly(previous.id);
    }
    if (
      !isMountedRef.current ||
      session !== profileEditorSessionRef.current ||
      generation !== avatarUploadGenerationRef.current
    ) {
      await deletePendingAttachmentQuietly(attachment.id);
      return false;
    }
    pendingAvatarAttachmentRef.current = attachment;
    setPendingAvatarAttachment(attachment);
    return true;
  }

  function openProfileEditor() {
    profileEditorSessionRef.current += 1;
    setEditProfile(profile ?? {});
    setIsModalOpen(true);
  }

  function changeProfileEditorOpen(open: boolean) {
    if (open) {
      openProfileEditor();
      return;
    }
    if (profileEditing) return;
    profileEditorSessionRef.current += 1;
    avatarUploadGenerationRef.current += 1;
    setIsModalOpen(false);
    setEditProfile(profile ?? {});
    void discardPendingAvatarAttachment();
  }

  function generateOpenKeyFun() {
    if (displayedResourceState?.openKey.canCreate === false) {
      toast.error(t('resources.openKey.creationBlocked'));
      return;
    }
    const toastId = toast.loading(t('creating'));
    post('/api-keys')
      .then(async () => {
        await Promise.all([mutateOpenKeys(), mutateResourceState()]);
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
      const session = profileEditorSessionRef.current;
      const generation = ++avatarUploadGenerationRef.current;
      setAvatarUploading(true);
      const croppedImage = await createCroppedImage(avatarFile, croppedAreaPixels);
      const attachment = await uploadAvatar(croppedImage);
      const accepted = await acceptPendingAvatarAttachment(attachment, session, generation);
      if (!accepted) {
        setAvatarUploading(false);
        return;
      }

      setEditProfile((current) => ({
        ...current,
        avatar: profileAttachmentUrl(attachment),
      }));
      setAvatarUploading(false);
      setIsAvatarModalOpen(false);
      setAvatarFile(null);
      toast.success(t('uploadSuccess'));
    } catch (_error: any) {
      toast.error(`${t('uploadFailed')}: ${getUploadErrorMessage(_error)}`);
      setAvatarUploading(false);
    }
  }

  async function saveProfile() {
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
    try {
      await patchProfile({
        ...(editProfile as Partial<NonNullable<Profile>>),
        ...(pendingAvatarAttachment ? { avatarAttachmentId: pendingAvatarAttachment.id } : {}),
      });
      pendingAvatarAttachmentRef.current = null;
      setPendingAvatarAttachment(null);
      profileEditorSessionRef.current += 1;
      toast.success(t('editSuccess'));
      setIsModalOpen(false);
    } catch (error: any) {
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
      profileEditorSessionRef.current += 1;
      setIsModalOpen(false);
      setEditProfile(profile ?? {});
      await discardPendingAvatarAttachment();
    } finally {
      setProfileEditing(false);
    }
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

    const generation = ++coverUploadGenerationRef.current;
    setCoverChangeing(true);
    let uploadedAttachment: Attachment | null = null;
    try {
      uploadedAttachment = await uploadCover(selectedFile);
      if (!isMountedRef.current || generation !== coverUploadGenerationRef.current) {
        await deletePendingAttachmentQuietly(uploadedAttachment.id);
        return;
      }
      await patchProfile({
        cover: profileAttachmentUrl(uploadedAttachment),
        coverAttachmentId: uploadedAttachment.id,
      });
    } catch (_error: any) {
      if (uploadedAttachment) {
        await deletePendingAttachmentQuietly(uploadedAttachment.id);
      }
      if (isMountedRef.current && generation === coverUploadGenerationRef.current) {
        toast.error(`${t('uploadFailed')}: ${getUploadErrorMessage(_error)}`);
      }
    } finally {
      if (isMountedRef.current && generation === coverUploadGenerationRef.current) {
        setCoverChangeing(false);
      }
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
        <NavBar title={t('title')} icon={<ScanFace className="size-5" />} />
        <ProfileHeader
          profile={profile}
          canUpload={canUpload}
          coverChangeing={coverChangeing}
          inputCoverRef={inputCoverRef}
          inputAvatarRef={inputAvatarRef}
          onChangeCover={changeCover}
          onOpenEditProfile={openProfileEditor}
        />

        <OpenKeySection
          openKeys={openKeys}
          isLoading={openKeyLoading}
          onCreateOpenKey={generateOpenKeyFun}
          onMutate={mutateOpenKeys}
          canCreate={displayedResourceState?.openKey.canCreate !== false}
          resourceState={showOfficialResources ? displayedResourceState?.openKey : undefined}
        />

        <EditProfileDialog
          isOpen={isModalOpen}
          onOpenChange={changeProfileEditorOpen}
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
