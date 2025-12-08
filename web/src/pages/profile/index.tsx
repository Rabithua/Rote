import NavBar from '@/components/layout/navBar';
import { useSiteStatus } from '@/hooks/useSiteStatus';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import {
  loadProfileAtom,
  loadUserSettingsAtom,
  patchProfileAtom,
  profileAtom,
  userSettingsAtom,
} from '@/state/profile';
import type { OpenKeys, Profile } from '@/types/main';
import { del, get, post, put } from '@/utils/api';
import { authService } from '@/utils/auth';
import { useAPIGet } from '@/utils/fetcher';
import { useAtomValue, useSetAtom } from 'jotai';
import { Stars, UserCircle2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Area } from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import AvatarCropDialog from './components/AvatarCropDialog';
import DeleteAccountDialog from './components/DeleteAccountDialog';
import EditProfileDialog from './components/EditProfileDialog';
import MergeAccountDialog from './components/MergeAccountDialog';
import OpenKeySection from './components/OpenKeySection';
import ProfileHeader from './components/ProfileHeader';
import ProfileSidebar from './components/ProfileSidebar';
import SettingsDialog from './components/SettingsDialog';
import { createCroppedImage, uploadAvatar, uploadCover } from './utils/avatarUpload';

function ProfilePage() {
  const { data: siteStatus } = useSiteStatus();
  const canUpload =
    !!siteStatus?.storage?.r2Configured && siteStatus?.ui?.allowUploadFile !== false;
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });
  const inputAvatarRef = useRef<HTMLInputElement>(null);
  const inputCoverRef = useRef<HTMLInputElement>(null);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState<boolean>(false);
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);
  const [coverChangeing, setCoverChangeing] = useState(false);

  // 使用 Jotai 托管 profile 与 user settings，避免全量订阅引发的重渲染
  const profile = useAtomValue(profileAtom);
  const userSettings = useAtomValue(userSettingsAtom);
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
  const [allowExplore, setAllowExplore] = useState<boolean>(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [isBindingGitHub, setIsBindingGitHub] = useState(false);
  const [isUnbindingGitHub, setIsUnbindingGitHub] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeInfo, setMergeInfo] = useState<{
    existingUserId: string;
    existingUsername: string;
    existingEmail: string;
    githubUserId: string;
    githubUsername: string;
  } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // profile 加载后，同步到可编辑状态；settings 单独从 userSettings 同步
  useEffect(() => {
    if (profile) {
      setEditProfile(profile);
    }
  }, [profile]);

  useEffect(() => {
    setAllowExplore(userSettings?.allowExplore ?? true);
  }, [userSettings]);

  // 处理 OAuth 绑定回调
  useEffect(() => {
    const oauthStatus = searchParams.get('oauth');
    const bindStatus = searchParams.get('bind');
    const errorMessage = searchParams.get('message');
    const merged = searchParams.get('merged');
    const existingUserId = searchParams.get('existingUserId');
    const existingUsername = searchParams.get('existingUsername');
    const existingEmail = searchParams.get('existingEmail');
    const githubUserId = searchParams.get('githubUserId');
    const githubUsername = searchParams.get('githubUsername');

    if (oauthStatus === 'bind') {
      if (bindStatus === 'success') {
        if (merged === 'true') {
          toast.success(t('settings.oauth.github.mergeSuccess'));
        } else {
          toast.success(t('settings.oauth.github.bindSuccess'));
        }
        loadProfile(); // 刷新 profile 数据
        // 清除 URL 参数
        setSearchParams({}, { replace: true });
      } else if (bindStatus === 'merge_required') {
        // 需要合并账户，显示确认对话框
        if (existingUserId && githubUserId) {
          setMergeInfo({
            existingUserId,
            existingUsername: existingUsername || '',
            existingEmail: existingEmail || '',
            githubUserId,
            githubUsername: githubUsername || '',
          });
          setIsMergeDialogOpen(true);
          // 清除 URL 参数
          setSearchParams({}, { replace: true });
        }
      } else if (bindStatus === 'error' && errorMessage) {
        toast.error(
          t('settings.oauth.github.bindFailed', { error: decodeURIComponent(errorMessage) })
        );
        // 清除 URL 参数
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, t, loadProfile, setSearchParams]);

  // 绑定 GitHub
  const handleBindGitHub = async () => {
    setIsBindingGitHub(true);
    try {
      const redirectUrl = '/profile';
      const response = await get(
        `/auth/oauth/github/bind?redirect=${encodeURIComponent(redirectUrl)}`
      );
      if (response.data?.redirectUrl) {
        // 跳转到 GitHub 授权页面
        window.location.href = response.data.redirectUrl;
      } else {
        throw new Error('Failed to get GitHub authorization URL');
      }
    } catch (err: any) {
      setIsBindingGitHub(false);
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
      toast.error(t('settings.oauth.github.bindFailed', { error: errorMessage }));
    }
  };

  // 解绑 GitHub
  const handleUnbindGitHub = async () => {
    setIsUnbindingGitHub(true);
    try {
      await del('/auth/oauth/github/bind');
      toast.success(t('settings.oauth.github.unbindSuccess'));
      loadProfile(); // 刷新 profile 数据
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
      toast.error(t('settings.oauth.github.unbindFailed', { error: errorMessage }));
    } finally {
      setIsUnbindingGitHub(false);
    }
  };

  // 确认合并账户
  const handleConfirmMerge = async () => {
    if (!mergeInfo) return;

    setIsMerging(true);
    try {
      const response = await post('/auth/oauth/github/bind/merge', {
        existingUserId: mergeInfo.existingUserId,
        githubUserId: mergeInfo.githubUserId,
        githubUsername: mergeInfo.githubUsername,
      });

      if (response.data?.merged) {
        // 设置 URL 参数以触发 useEffect 中的成功消息显示
        setSearchParams(
          {
            oauth: 'bind',
            bind: 'success',
            merged: 'true',
          },
          { replace: true }
        );
        setIsMergeDialogOpen(false);
        setMergeInfo(null);
        loadProfile(); // 刷新 profile 数据
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
      toast.error(t('settings.oauth.github.mergeFailed', { error: errorMessage }));
    } finally {
      setIsMerging(false);
    }
  };

  // 取消合并
  const handleCancelMerge = () => {
    setIsMergeDialogOpen(false);
    setMergeInfo(null);
  };

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
    if (selectedFile) {
      setAvatarFile(selectedFile);
      setIsAvatarModalOpen(true);
    }
  }

  // 保存头像
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
    if (!profile) return;
    setProfileEditing(true);
    patchProfile(editProfile as Partial<NonNullable<Profile>>)
      .then(() => {
        toast.success(t('editSuccess'));
        setIsModalOpen(false);
        setProfileEditing(false);
      })
      .catch(() => {
        toast.error(t('editFailed'));
        setIsModalOpen(false);
        setProfileEditing(false);
      });
  }

  async function saveSettings() {
    try {
      setSettingsSaving(true);
      await put('/users/me/settings', {
        allowExplore,
      });
      toast.success(t('settings.saveSuccess'));
      setIsSettingsModalOpen(false);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        error?.response?.data?.error ||
        'Unknown error';
      toast.error(t('settings.saveFailed', { error: errorMessage }));
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deletePassword) {
      toast.error(t('settings.deleteAccount.passwordRequired'));
      return;
    }

    try {
      setIsDeletingAccount(true);
      // 使用 axios 的 delete 方法，通过 config.data 传递 body
      await del('/users/me', {
        data: { password: deletePassword },
      });
      toast.success(t('settings.deleteAccount.success'));
      // 删除成功后登出并跳转
      setTimeout(() => {
        authService.logout(true);
      }, 1000);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        error?.response?.data?.error ||
        'Unknown error';
      toast.error(t('settings.deleteAccount.failed', { error: errorMessage }));
    } finally {
      setIsDeletingAccount(false);
      setDeletePassword('');
    }
  }

  async function changeCover(event: React.ChangeEvent<HTMLInputElement>) {
    if (!canUpload) return;
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

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
        <div className="flex items-center gap-2 p-4 text-lg font-semibold">
          <div className="flex items-center gap-2">
            <Stars className="size-5" />
            {t('sideBarTitle')}
          </div>
        </div>
      }
    >
      <div className="flex flex-col divide-y pb-20">
        <NavBar title={t('title')} icon={<UserCircle2 className="size-7" />} />
        <ProfileHeader
          profile={profile}
          canUpload={canUpload}
          coverChangeing={coverChangeing}
          inputCoverRef={inputCoverRef}
          inputAvatarRef={inputAvatarRef}
          onChangeCover={changeCover}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
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

        <SettingsDialog
          isOpen={isSettingsModalOpen}
          onOpenChange={setIsSettingsModalOpen}
          allowExplore={allowExplore}
          onAllowExploreChange={(checked) => setAllowExplore(checked)}
          onSave={saveSettings}
          isSaving={settingsSaving}
          profile={profile}
          isBindingGitHub={isBindingGitHub}
          isUnbindingGitHub={isUnbindingGitHub}
          onBindGitHub={handleBindGitHub}
          onUnbindGitHub={handleUnbindGitHub}
          onDeleteAccount={() => {
            setIsSettingsModalOpen(false);
            setIsDeleteAccountModalOpen(true);
          }}
        />

        <MergeAccountDialog
          isOpen={isMergeDialogOpen}
          onOpenChange={setIsMergeDialogOpen}
          mergeInfo={mergeInfo}
          profile={profile}
          onConfirm={handleConfirmMerge}
          onCancel={handleCancelMerge}
          isMerging={isMerging}
        />

        <DeleteAccountDialog
          isOpen={isDeleteAccountModalOpen}
          onOpenChange={setIsDeleteAccountModalOpen}
          password={deletePassword}
          onPasswordChange={setDeletePassword}
          onConfirm={handleDeleteAccount}
          onCancel={() => {
            setIsDeleteAccountModalOpen(false);
            setDeletePassword('');
          }}
          isDeleting={isDeletingAccount}
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
