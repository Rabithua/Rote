import defaultCover from '@/assets/img/defaultCover.png';
import NavBar from '@/components/layout/navBar';
import OpenKeyItem from '@/components/openKey/openKey';
import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import type { OpenKeys, Profile } from '@/types/main';
import { get, post, put } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import Linkify from 'linkify-react';
import {
  Edit,
  KeyRoundIcon,
  Loader,
  LoaderPinwheel,
  Rss,
  Stars,
  User,
  UserCircle2,
} from 'lucide-react';
import moment from 'moment';
import { useCallback, useRef, useState } from 'react';
import type { Area } from 'react-easy-crop';
import Cropper from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

function ProfilePage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });
  const inputAvatarRef = useRef<HTMLInputElement>(null);
  const inputCoverRef = useRef<HTMLInputElement>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState<boolean>(false);
  const [coverChangeing, setCoverChangeing] = useState(false);

  const { data: profile, mutate } = useAPIGet<Profile>('profile', () =>
    get('/users/me/profile').then((res) => res.data)
  );

  const {
    data: openKeys,
    mutate: mutateOpenKeys,
    isLoading: openKeyLoading,
  } = useAPIGet<OpenKeys>('openKeys', () => get('/api-keys').then((res) => res.data));

  const [editProfile, setEditProfile] = useState<any>(profile);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);

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

      const formData = new FormData();
      formData.append(
        'images',
        new File([croppedImage], 'cropped_image.png', {
          type: 'image/png',
        })
      );

      const res = await post('/attachments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setEditProfile({
        ...editProfile,
        avatar: res.data[0].compressUrl || res.data[0].url,
      });
      setAvatarUploading(false);
      setIsAvatarModalOpen(false);
      toast.success(t('uploadSuccess'));
    } catch {
      toast.error(t('uploadFailed'));
      setAvatarUploading(false);
    }
  }

  function saveProfile() {
    setProfileEditing(true);
    put('/users/me/profile', editProfile)
      .then(() => {
        toast.success(t('editSuccess'));
        mutate();
        setIsModalOpen(false);
        setProfileEditing(false);
      })
      .catch(() => {
        toast.error(t('editFailed'));
        setIsModalOpen(false);
        setProfileEditing(false);
      });
  }

  function changeCover(event: any) {
    setCoverChangeing(true);
    const selectedFile = event.target.files[0];

    if (selectedFile) {
      const formData = new FormData();
      formData.append('images', selectedFile);

      post('/attachments', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(
        (res) => {
          const url = res.data.data[0].compressUrl || res.data.data[0].url;

          put('/users/me/profile', {
            cover: url,
          })
            .then(() => {
              mutate();
              setCoverChangeing(false);
            })
            .catch(() => {
              setCoverChangeing(false);
            });
        }
      );
    }
  }

  const SideBar = () => (
    <div className="grid grid-cols-3 divide-x-1 border-b">
      <a
        href={`${process.env.REACT_APP_BASEURL_PRD || 'http://localhost:3000'}/v1/api/rss/${profile?.username}`}
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

  return (
    <ContainerWithSideBar
      sidebar={<SideBar />}
      sidebarHeader={
        <div className="flex items-center gap-2 p-4 text-lg font-semibold">
          <div className="flex h-8 items-center gap-2">
            <Stars className="size-5" />
            {t('sideBarTitle')}
          </div>
        </div>
      }
    >
      <div className="flex flex-col divide-y-1 pb-20">
        <NavBar title={t('title')} icon={<UserCircle2 className="size-8" />} />
        <div className="pb-4">
          <div className="relative aspect-[3] w-full overflow-hidden">
            <img
              className="h-full w-full object-cover"
              src={profile?.cover || defaultCover}
              alt=""
            />
            <div
              className="absolute right-3 bottom-1 cursor-pointer rounded-md bg-[#00000030] px-2 py-1 text-white backdrop-blur-xl"
              onClick={() => {
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
                disabled={coverChangeing}
                title="Upload cover image"
              />
              <LoaderPinwheel className={`size-4 ${coverChangeing && 'animate-spin'}`} />
            </div>
          </div>
          <div className="mx-4 flex h-16 items-center">
            <Avatar
              className="gLight text-primary size-20 shrink-0 translate-y-[-50%] cursor-pointer border-[4px] sm:block"
              onClick={() => {
                (inputAvatarRef.current as HTMLInputElement | null)?.click();
              }}
            >
              {profile?.avatar ? (
                <AvatarImage src={profile.avatar} />
              ) : (
                <AvatarFallback>
                  <User className="size-4 text-[#00000010]" />
                </AvatarFallback>
              )}
            </Avatar>
            <Button
              className="ml-auto"
              onClick={() => {
                setIsModalOpen(true);
              }}
            >
              <Edit className="size-4" />
              {t('editProfile')}
            </Button>
          </div>
          <div className="mx-4 flex flex-col gap-1">
            <Link to={`/${profile?.username}`}>
              <h1 className="w-fit text-2xl font-semibold hover:underline">{profile?.nickname}</h1>
              <h2 className="text-info w-fit text-base hover:underline">@{profile?.username}</h2>
            </Link>
            <div className="text-base">
              <div className="aTagStyle break-words whitespace-pre-line">
                <Linkify>{(profile?.description as any) || t('noDescription')}</Linkify>
              </div>
            </div>
            <div className="text-info text-base">
              {t('registerTime')}
              {moment.utc(profile?.createdAt).format('YYYY/MM/DD HH:mm:ss')}
            </div>
          </div>
        </div>

        <div className="flex flex-col divide-y-1">
          <div className="p-4 text-2xl font-semibold">
            OpenKey <br />
            <div className="text-info mt-2 text-sm font-normal">{t('openKeyDescription')}</div>
          </div>
          <div className="flex flex-col divide-y-1">
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
            <div className="flex w-full cursor-default gap-5">
              <div className="flex w-full flex-col gap-1">
                <input
                  type="file"
                  accept="image/*"
                  max="1"
                  className="hidden"
                  ref={inputAvatarRef}
                  onChange={handleFileChange}
                  title="Upload avatar image"
                />
                {/* 编辑弹窗内头像同理 */}
                <Avatar
                  className="text-primary mx-auto my-2 block size-20 shrink-0 cursor-pointer bg-[#00000010]"
                  onClick={() => {
                    (inputAvatarRef.current as HTMLInputElement | null)?.click();
                  }}
                >
                  {editProfile.avatar ? (
                    <AvatarImage src={editProfile.avatar} />
                  ) : (
                    <AvatarFallback>
                      <User className="size-4 text-[#00000030]" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="mt-2 text-base font-semibold">{t('email')}</div>
                <Input
                  disabled
                  className="w-full rounded-md font-mono text-lg"
                  maxLength={20}
                  value={editProfile.email}
                />
                <div className="mt-2 text-base font-semibold">{t('username')}</div>
                <Input
                  disabled
                  className="w-full rounded-md font-mono text-lg"
                  maxLength={20}
                  value={editProfile.username}
                />
                <div className="mt-2 text-base font-semibold">{t('nickname')}</div>
                <Input
                  placeholder={t('enterNickname')}
                  className="w-full rounded-md font-mono text-lg"
                  maxLength={20}
                  value={editProfile.nickname}
                  onInput={(e: React.FormEvent<HTMLInputElement>) => {
                    setEditProfile({
                      ...editProfile,
                      nickname: (e.target as HTMLInputElement).value,
                    });
                  }}
                />
                <div className="mt-2 text-base font-semibold">{t('description')}</div>
                <Textarea
                  placeholder={t('enterDescription')}
                  className="w-full rounded-md text-lg"
                  maxLength={300}
                  value={editProfile.description}
                  style={{ height: 120, resize: 'none' }}
                  onInput={(e: React.FormEvent<HTMLTextAreaElement>) => {
                    setEditProfile({
                      ...editProfile,
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
        <Dialog open={isAvatarModalOpen} onOpenChange={setIsAvatarModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('cropAvatar')}</DialogTitle>
            </DialogHeader>
            <div className="relative h-[300px] w-full">
              <Cropper
                image={editProfile.avatar_file && URL.createObjectURL(editProfile.avatar_file)}
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

export default ProfilePage;
