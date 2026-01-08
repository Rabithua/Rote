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
import { isHeicFile } from '@/utils/uploadHelpers';
import { useAtomValue, useSetAtom } from 'jotai';
import { Stars, UserCircle2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Area } from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
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
  const { t: tLogin } = useTranslation('translation', { keyPrefix: 'pages.login' });
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
  const [bindingProviders, setBindingProviders] = useState<Record<string, boolean>>({});
  const [unbindingProviders, setUnbindingProviders] = useState<Record<string, boolean>>({});
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeInfo, setMergeInfo] = useState<{
    existingUserId: string;
    existingUsername: string;
    existingEmail: string;
    provider: string;
    providerUserId: string;
    providerUsername: string;
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
    const provider = searchParams.get('provider') || 'github';
    const existingUserId = searchParams.get('existingUserId');
    const existingUsername = searchParams.get('existingUsername');
    const existingEmail = searchParams.get('existingEmail');
    // 动态获取提供商特定的用户 ID 和用户名参数
    const providerUserId = searchParams.get(`${provider}UserId`);
    const providerUsername = searchParams.get(`${provider}Username`);

    if (oauthStatus === 'bind') {
      if (bindStatus === 'success') {
        if (merged === 'true') {
          // 使用通用的成功消息（如果有特定消息则使用）
          const successKey = `settings.oauth.${provider}.mergeSuccess`;
          const fallbackKey = 'settings.oauth.mergeSuccess';
          toast.success(t(successKey, { defaultValue: t(fallbackKey) }));
        } else {
          // 使用通用的成功消息（如果有特定消息则使用）
          const successKey = `settings.oauth.${provider}.bindSuccess`;
          const fallbackKey = 'settings.oauth.bindSuccess';
          toast.success(t(successKey, { defaultValue: t(fallbackKey) }));
        }
        loadProfile(); // 刷新 profile 数据
        // 清除 URL 参数
        setSearchParams({}, { replace: true });
      } else if (bindStatus === 'merge_required') {
        // 需要合并账户，显示确认对话框
        if (existingUserId && providerUserId) {
          setMergeInfo({
            existingUserId,
            existingUsername: existingUsername || '',
            existingEmail: existingEmail || '',
            provider,
            providerUserId,
            providerUsername: providerUsername || '',
          });
          setIsMergeDialogOpen(true);
          // 清除 URL 参数
          setSearchParams({}, { replace: true });
        }
      } else if (bindStatus === 'error' && errorMessage) {
        // 使用通用的错误消息（如果有特定消息则使用）
        const errorKey = `settings.oauth.${provider}.bindFailed`;
        const fallbackKey = 'settings.oauth.bindFailed';
        toast.error(
          t(errorKey, {
            error: decodeURIComponent(errorMessage),
            defaultValue: t(fallbackKey, { error: decodeURIComponent(errorMessage) }),
          })
        );
        // 清除 URL 参数
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, t, loadProfile, setSearchParams]);

  // 确认合并账户
  const handleConfirmMerge = async () => {
    if (!mergeInfo) return;

    setIsMerging(true);
    try {
      const endpoint = `/auth/oauth/${mergeInfo.provider}/bind/merge`;
      // 动态构建 payload，根据提供商名称构建参数名
      const payload: any = {
        existingUserId: mergeInfo.existingUserId,
        [`${mergeInfo.provider}UserId`]: mergeInfo.providerUserId,
      };
      if (mergeInfo.providerUsername) {
        payload[`${mergeInfo.provider}Username`] = mergeInfo.providerUsername;
      }

      const response = await post(endpoint, payload);

      if (response.data?.merged) {
        // 设置 URL 参数以触发 useEffect 中的成功消息显示
        setSearchParams(
          {
            oauth: 'bind',
            bind: 'success',
            merged: 'true',
            provider: mergeInfo.provider,
          },
          { replace: true }
        );
        setIsMergeDialogOpen(false);
        setMergeInfo(null);
        loadProfile(); // 刷新 profile 数据
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
      const errorKey = `settings.oauth.${mergeInfo.provider}.mergeFailed`;
      const fallbackKey = 'settings.oauth.mergeFailed';
      toast.error(
        t(errorKey, { error: errorMessage, defaultValue: t(fallbackKey, { error: errorMessage }) })
      );
    } finally {
      setIsMerging(false);
    }
  };

  // 取消合并
  const handleCancelMerge = () => {
    setIsMergeDialogOpen(false);
    setMergeInfo(null);
  };

  // 通用 OAuth 绑定处理函数
  const handleBindOAuth = async (provider: string) => {
    setBindingProviders((prev) => ({ ...prev, [provider]: true }));
    try {
      const redirectUrl = '/profile';
      const response = await get(
        `/auth/oauth/${provider}/bind?redirect=${encodeURIComponent(redirectUrl)}`
      );
      if (response.data?.redirectUrl) {
        // 跳转到 OAuth 授权页面
        window.location.href = response.data.redirectUrl;
      } else {
        throw new Error(`Failed to get ${provider} authorization URL`);
      }
    } catch (err: any) {
      setBindingProviders((prev) => ({ ...prev, [provider]: false }));
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
      const errorKey = `settings.oauth.${provider}.bindFailed`;
      const fallbackKey = 'settings.oauth.bindFailed';
      toast.error(
        t(errorKey, { error: errorMessage, defaultValue: t(fallbackKey, { error: errorMessage }) })
      );
    }
  };

  // 通用 OAuth 解绑处理函数
  const handleUnbindOAuth = async (provider: string) => {
    setUnbindingProviders((prev) => ({ ...prev, [provider]: true }));
    try {
      await del(`/auth/oauth/${provider}/bind`);
      const successKey = `settings.oauth.${provider}.unbindSuccess`;
      const fallbackKey = 'settings.oauth.unbindSuccess';
      toast.success(t(successKey, { defaultValue: t(fallbackKey) }));
      loadProfile(); // 刷新 profile 数据
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
      const errorKey = `settings.oauth.${provider}.unbindFailed`;
      const fallbackKey = 'settings.oauth.unbindFailed';
      toast.error(
        t(errorKey, { error: errorMessage, defaultValue: t(fallbackKey, { error: errorMessage }) })
      );
    } finally {
      setUnbindingProviders((prev) => ({ ...prev, [provider]: false }));
    }
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
    if (!selectedFile) return;

    // 检查是否为 HEIC 格式（不支持）
    if (isHeicFile(selectedFile)) {
      toast.error(t('heicNotSupported'));
      // 清空 input 值，允许用户重新选择
      event.target.value = '';
      return;
    }

    setAvatarFile(selectedFile);
    setIsAvatarModalOpen(true);
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
    if (!profile || !editProfile) return;

    // 如果用户名有变化，进行验证
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
        // 处理后端返回的错误
        const errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          error?.response?.data?.error ||
          t('editFailed');

        // 检查是否是用户名相关的错误
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

    // 检查是否为 HEIC 格式（不支持）
    if (isHeicFile(selectedFile)) {
      toast.error(t('heicNotSupported'));
      // 清空 input 值，允许用户重新选择
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

        <SettingsDialog
          isOpen={isSettingsModalOpen}
          onOpenChange={setIsSettingsModalOpen}
          allowExplore={allowExplore}
          onAllowExploreChange={(checked) => setAllowExplore(checked)}
          onSave={saveSettings}
          isSaving={settingsSaving}
          profile={profile}
          onDeleteAccount={() => {
            setIsSettingsModalOpen(false);
            setIsDeleteAccountModalOpen(true);
          }}
          enabledOAuthProviders={siteStatus?.oauth?.providers || {}}
          bindingProviders={bindingProviders}
          unbindingProviders={unbindingProviders}
          onBindOAuth={handleBindOAuth}
          onUnbindOAuth={handleUnbindOAuth}
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
