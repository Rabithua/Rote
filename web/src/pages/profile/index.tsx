import defaultCover from '@/assets/img/defaultCover.png';
import NavBar from '@/components/layout/navBar';
import OpenKeyItem from '@/components/openKey/openKey';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import UserAvatar from '@/components/others/UserAvatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useSiteStatus } from '@/hooks/useSiteStatus';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import {
  loadProfileAtom,
  loadUserSettingsAtom,
  patchProfileAtom,
  profileAtom,
  userSettingsAtom,
} from '@/state/profile';
import type { OpenKeys } from '@/types/main';
import { API_URL, del, get, post, put } from '@/utils/api';
import { authService } from '@/utils/auth';
import { finalize, presign, uploadToSignedUrl } from '@/utils/directUpload';
import { useAPIGet } from '@/utils/fetcher';
import { maybeCompressToWebp } from '@/utils/uploadHelpers';
import { useAtomValue, useSetAtom } from 'jotai';
import Linkify from 'linkify-react';
import {
  Edit,
  KeyRoundIcon,
  Loader,
  LoaderPinwheel,
  Rss,
  Settings2,
  Stars,
  UserCircle2,
} from 'lucide-react';
import moment from 'moment';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Area } from 'react-easy-crop';
import Cropper from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

function ProfilePage() {
  const { data: siteStatus } = useSiteStatus();
  const canUpload =
    !!siteStatus?.storage?.r2Configured && siteStatus?.ui?.allowUploadFile !== false;
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });
  const inputAvatarRef = useRef<HTMLInputElement>(null);
  const inputCoverRef = useRef<HTMLInputElement>(null);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
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

  const [editProfile, setEditProfile] = useState<any>(profile ?? {});
  const [allowExplore, setAllowExplore] = useState<boolean>(true);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // profile 加载后，同步到可编辑状态；settings 单独从 userSettings 同步
  useEffect(() => {
    if (profile) {
      setEditProfile(profile);
    }
  }, [profile]);

  useEffect(() => {
    setAllowExplore(userSettings?.allowExplore ?? true);
  }, [userSettings]);

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

  function handleFileChange(event: any) {
    if (!canUpload) return;
    const selectedFile = event.target.files[0];
    setEditProfile({
      ...editProfile,
      avatar_file: selectedFile,
    });
    setIsAvatarModalOpen(true);
  }

  // 生成裁剪后的图片
  const createCroppedImage = async (imageSrc: File | Blob, pixelCrop: Area): Promise<Blob> => {
    const image = new Image();
    image.src = URL.createObjectURL(imageSrc);

    return new Promise((resolve, reject) => {
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // 设置画布尺寸为裁剪区域的尺寸
        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        // 在画布上绘制裁剪后的图像
        ctx.drawImage(
          image,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          pixelCrop.width,
          pixelCrop.height
        );

        // 将画布转换为Blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas is empty'));
          }
        }, 'image/png');
      };

      image.onerror = () => {
        reject(new Error('Could not load image'));
      };
    });
  };

  // 裁剪完成回调
  const onCropComplete = useCallback((_: any, croppedAreaPixelsData: Area) => {
    setCroppedAreaPixels(croppedAreaPixelsData);
  }, []);

  // 保存头像
  async function avatarEditSave() {
    if (!croppedAreaPixels || !editProfile.avatar_file) {
      toast.error(t('cropError'));
      return;
    }

    try {
      setAvatarUploading(true);
      const croppedImage = await createCroppedImage(editProfile.avatar_file, croppedAreaPixels);

      // 将 Blob 转换为 File
      const croppedFile = new File([croppedImage], 'cropped_image.png', {
        type: 'image/png',
      });

      // 获取预签名 URL
      const signItems = await presign([
        {
          filename: croppedFile.name,
          contentType: croppedFile.type,
          size: croppedFile.size,
        },
      ]);

      const item = signItems[0];
      if (!item) {
        throw new Error('Failed to get presign URL');
      }

      // 压缩图片（用于压缩图）
      const compressedBlob = await maybeCompressToWebp(croppedFile, {
        maxWidthOrHeight: 512,
        initialQuality: 0.8,
      });

      // 上传原图
      await uploadToSignedUrl(item.original.putUrl, croppedFile);

      // 上传压缩图（如果压缩成功）
      if (compressedBlob) {
        await uploadToSignedUrl(item.compressed.putUrl, compressedBlob);
      }

      // 完成上传
      const finalized = await finalize([
        {
          uuid: item.uuid,
          originalKey: item.original.key,
          compressedKey: compressedBlob ? item.compressed.key : undefined,
          size: croppedFile.size,
          mimetype: croppedFile.type,
        },
      ]);

      if (finalized && finalized.length > 0) {
        const attachment = finalized[0];
        setEditProfile({
          ...editProfile,
          avatar: attachment.compressUrl || attachment.url,
        });
        setAvatarUploading(false);
        setIsAvatarModalOpen(false);
        toast.success(t('uploadSuccess'));
      } else {
        throw new Error('Failed to finalize upload');
      }
    } catch (_error: any) {
      toast.error(t('uploadFailed'));
      setAvatarUploading(false);
    }
  }

  function saveProfile() {
    setProfileEditing(true);
    patchProfile(editProfile)
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

  async function changeCover(event: any) {
    if (!canUpload) return;
    setCoverChangeing(true);
    const selectedFile = event.target.files[0];

    if (selectedFile) {
      try {
        // 获取预签名 URL
        const signItems = await presign([
          {
            filename: selectedFile.name,
            contentType: selectedFile.type || 'image/jpeg',
            size: selectedFile.size,
          },
        ]);

        const item = signItems[0];
        if (!item) {
          throw new Error('Failed to get presign URL');
        }

        // 压缩图片（用于压缩图）
        const compressedBlob = await maybeCompressToWebp(selectedFile, {
          maxWidthOrHeight: 2560,
          initialQuality: 0.8,
        });

        // 上传原图
        await uploadToSignedUrl(item.original.putUrl, selectedFile);

        // 上传压缩图（如果压缩成功）
        if (compressedBlob) {
          await uploadToSignedUrl(item.compressed.putUrl, compressedBlob);
        }

        // 完成上传
        const finalized = await finalize([
          {
            uuid: item.uuid,
            originalKey: item.original.key,
            compressedKey: compressedBlob ? item.compressed.key : undefined,
            size: selectedFile.size,
            mimetype: selectedFile.type || 'image/jpeg',
          },
        ]);

        if (finalized && finalized.length > 0) {
          const attachment = finalized[0];
          const url = attachment.compressUrl || attachment.url;

          await patchProfile({
            cover: url,
          });
          setCoverChangeing(false);
        } else {
          throw new Error('Failed to finalize upload');
        }
      } catch (_error: any) {
        setCoverChangeing(false);
        toast.error(t('uploadFailed'));
      }
    }
  }

  return (
    <ContainerWithSideBar
      sidebar={<SideBar />}
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
        <NavBar title={t('title')} icon={<UserCircle2 className="size-8 p-0.5" />} />
        <div className="pb-4">
          <div className="relative aspect-[3] w-full overflow-hidden">
            <img
              className="h-full w-full object-cover"
              src={profile?.cover || defaultCover}
              alt=""
            />
            <button
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
              <input
                type="file"
                accept="image/*"
                max="1"
                className="hidden"
                ref={inputCoverRef}
                onChange={changeCover}
                disabled={coverChangeing || !canUpload}
                title="Upload cover image"
              />
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
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setIsSettingsModalOpen(true)}
              >
                <Settings2 className="size-4" />
              </Button>
              <Button
                onClick={() => {
                  setIsModalOpen(true);
                }}
              >
                <Edit className="size-4" />
                {t('editProfile')}
              </Button>
            </div>
          </div>
          <div className="mx-4 flex flex-col gap-1">
            <Link className="w-fit" to={`/${profile?.username}`}>
              <h1 className="w-fit text-2xl font-semibold hover:underline">{profile?.nickname}</h1>
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

        <div className="flex flex-col divide-y">
          <div className="p-4 text-2xl font-semibold">
            OpenKey <br />
            <div className="text-info mt-2 text-sm font-normal">{t('openKeyDescription')}</div>
          </div>
          <div className="flex flex-col divide-y">
            {openKeyLoading ? (
              <LoadingPlaceholder className="py-8" size={6} />
            ) : (
              <>
                {openKeys?.map((openKey: any) => (
                  <OpenKeyItem key={openKey.id} openKey={openKey} mutate={mutateOpenKeys} />
                ))}
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  {openKeys?.length === 0 && <KeyRoundIcon className="text-info size-8" />}
                  <Button
                    variant="secondary"
                    onClick={generateOpenKeyFun}
                    className="cursor-pointer p-4"
                  >
                    {openKeys?.length === 0 ? t('noOpenKey') : t('addOpenKey')}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
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
                  onChange={handleFileChange}
                  disabled={!canUpload}
                  title="Upload avatar image"
                />
                {/* 编辑弹窗内头像同理 */}
                <UserAvatar
                  avatar={editProfile?.avatar}
                  className="text-primary mx-auto my-2 block size-20 shrink-0 cursor-pointer bg-[#00000010]"
                  fallbackClassName="bg-muted/80"
                  onClick={() => {
                    if (!canUpload) return;
                    (inputAvatarRef.current as HTMLInputElement | null)?.click();
                  }}
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
                    setEditProfile({
                      ...((editProfile as any) || {}),
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
                    setEditProfile({
                      ...((editProfile as any) || {}),
                      description: (e.target as HTMLTextAreaElement).value,
                    });
                  }}
                />
                <Button
                  className={`mt-4 flex w-full items-center justify-center`}
                  onClick={() => {
                    if (!profileEditing) {
                      saveProfile();
                    }
                  }}
                >
                  {profileEditing && <Loader className="mr-2 size-4 animate-spin" />}
                  {profileEditing ? t('editing') : t('save')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* 额外设置：探索页展示等 */}
        <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('settings.title')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-base font-semibold">{t('settings.allowExploreLabel')}</div>
                  <p className="text-muted-foreground text-sm">
                    {t('settings.allowExploreDescription')}
                  </p>
                </div>
                <Switch
                  checked={allowExplore}
                  onCheckedChange={(checked) => setAllowExplore(!!checked)}
                />
              </div>

              <Button
                className="mt-2 w-full"
                onClick={() => {
                  if (!settingsSaving) {
                    saveSettings();
                  }
                }}
              >
                {settingsSaving && <Loader className="mr-2 size-4 animate-spin" />}
                {settingsSaving ? t('settings.saving') : t('settings.save')}
              </Button>

              <div className="border-t pt-4">
                <div className="space-y-2">
                  <div className="text-destructive text-base font-semibold">
                    {t('settings.deleteAccount.title')}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {t('settings.deleteAccount.description')}
                  </p>
                  <Button
                    variant="destructive"
                    className="mt-2 w-full"
                    onClick={() => {
                      setIsSettingsModalOpen(false);
                      setIsDeleteAccountModalOpen(true);
                    }}
                  >
                    {t('settings.deleteAccount.button')}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* 删除账户确认对话框 */}
        <Dialog open={isDeleteAccountModalOpen} onOpenChange={setIsDeleteAccountModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('settings.deleteAccount.confirmTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">{t('settings.deleteAccount.warning')}</p>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">
                  {t('settings.deleteAccount.passwordLabel')}
                </label>
                <Input
                  type="password"
                  placeholder={t('settings.deleteAccount.passwordPlaceholder')}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  disabled={isDeletingAccount}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isDeletingAccount && deletePassword) {
                      handleDeleteAccount();
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsDeleteAccountModalOpen(false);
                    setDeletePassword('');
                  }}
                  disabled={isDeletingAccount}
                >
                  {t('settings.deleteAccount.cancel')}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount || !deletePassword}
                >
                  {isDeletingAccount && <Loader className="mr-2 size-4 animate-spin" />}
                  {isDeletingAccount
                    ? t('settings.deleteAccount.deleting')
                    : t('settings.deleteAccount.confirm')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isAvatarModalOpen} onOpenChange={setIsAvatarModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('cropAvatar')}</DialogTitle>
            </DialogHeader>
            <div className="relative h-[300px] w-full">
              <Cropper
                image={editProfile?.avatar_file && URL.createObjectURL(editProfile.avatar_file)}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <Button
              className={`mt-4 w-full`}
              onClick={() => {
                if (!avatarUploading) {
                  avatarEditSave();
                }
              }}
            >
              {avatarUploading && <Loader className="mr-2 size-4 animate-spin" />}
              {avatarUploading ? t('uploading') : t('done')}
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </ContainerWithSideBar>
  );
}

const SideBar = () => {
  const profile = useAtomValue(profileAtom);
  return (
    <div className="grid grid-cols-3 divide-x border-b">
      <a
        href={`${API_URL}/rss/${profile?.username}`}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-foreground/3 flex cursor-pointer items-center justify-center gap-2 py-4"
      >
        <Rss className="size-5" />
        <div className="text-xl">RSS</div>
      </a>
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="text-xl">☝️</div>
      </div>
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="text-xl">🤓</div>
      </div>
    </div>
  );
};

export default ProfilePage;
