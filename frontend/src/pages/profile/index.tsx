import defaultCover from '@/assets/img/defaultCover.png';
import LoadingPlaceholder from '@/components/LoadingPlaceholder';
import NavHeader from '@/components/navHeader';
import OpenKeyItem from '@/components/openKey';
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
import { useRef, useState } from 'react';
import AvatarEditor from 'react-avatar-editor';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

function ProfilePage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });
  const inputAvatarRef = useRef(null);
  const inputCoverRef = useRef(null);
  const AvatarEditorRef = useRef(null);
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
    // 在这里处理选择的文件
    console.log(selectedFile);
    setEditProfile({
      ...editProfile,
      avatar_file: selectedFile,
    });
    setIsAvatarModalOpen(true);
  }

  async function avatarEditSave() {
    if (AvatarEditorRef.current) {
      setAvatarUploading(true);
      // @ts-ignore
      const canvas = AvatarEditorRef.current.getImage().toDataURL();
      fetch(canvas)
        .then((res) => res.blob())
        .then((blob) => {
          try {
            const formData = new FormData();
            formData.append(
              'images',
              new File([blob], 'cropped_image.png', {
                type: 'image/png',
              })
            );
            post('/attachments', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            }).then((res) => {
              console.log(res);
              setEditProfile({
                ...editProfile,
                avatar: res.data.data[0].compressUrl || res.data.data[0].url,
              });
              setAvatarUploading(false);
              setIsAvatarModalOpen(false);
              toast.success(t('uploadSuccess'));
            });
          } catch (error) {
            toast.error(t('uploadFailed'));
            setAvatarUploading(false);
            console.error('Error uploading image:', error);
          }
        });
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
      .catch((err) => {
        toast.error(t('editFailed'));
        setIsModalOpen(false);
        setProfileEditing(false);
        console.error('Error edit Profile:', err);
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
          console.log(res);
          let url = res.data.data[0].compressUrl || res.data.data[0].url;

          put('/users/me/profile', {
            cover: url,
          })
            .then(() => {
              mutate();
              setCoverChangeing(false);
            })
            .catch((err) => {
              console.error('Error edit Profile:', err);
              setCoverChangeing(false);
            });
        }
      );
    }
  }

  const SideBar = () => {
    return (
      <div className="grid grid-cols-3 divide-x-1 border-b">
        <a
          href={`${process.env.REACT_APP_BASEURL_PRD || 'http://localhost:3000'}/v1/api/rss/${profile?.username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:bg-opacityLight dark:hover:bg-opacityDark flex cursor-pointer items-center justify-center gap-2 py-4"
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
        <NavHeader title={t('title')} icon={<UserCircle2 className="size-8" />} />
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
                // @ts-ignore
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
          <div className="mx-4 flex h-16">
            <Avatar
              className="gLight size-20 shrink-0 translate-y-[-50%] cursor-pointer border-[4px] text-black sm:block"
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
            <div
              className="bg-bgDark text-textDark dark:bg-bgLight dark:text-textLight mt-auto ml-auto flex h-fit cursor-pointer items-center gap-2 rounded-md px-4 py-1 duration-300 select-none active:scale-95"
              onClick={() => {
                setIsModalOpen(true);
              }}
            >
              <Edit className="size-4" />
              {t('editProfile')}
            </div>
          </div>
          <div className="mx-4 flex flex-col gap-1">
            <Link to={`/${profile?.username}`}>
              <h1 className="w-fit text-2xl font-semibold hover:underline">{profile?.nickname}</h1>
              <h2 className="w-fit text-base text-gray-500 hover:underline">
                @{profile?.username}
              </h2>
            </Link>
            <div className="text-base">
              <div className="aTagStyle break-words whitespace-pre-line">
                <Linkify>{(profile?.description as any) || t('noDescription')}</Linkify>
              </div>
            </div>
            <div className="text-base text-gray-500">
              {t('registerTime')}
              {moment.utc(profile?.createdAt).format('YYYY/MM/DD HH:mm:ss')}
            </div>
          </div>
        </div>

        <div className="flex flex-col divide-y-1">
          <div className="p-4 text-2xl font-semibold">
            OpenKey <br />
            <div className="mt-2 text-sm font-normal text-gray-500">{t('openKeyDescription')}</div>
          </div>
          <div className="flex flex-col divide-y-1">
            {openKeyLoading ? (
              <LoadingPlaceholder className="py-8" size={6} />
            ) : (
              <>
                {openKeys?.map((openKey: any) => {
                  return <OpenKeyItem key={openKey.id} openKey={openKey} mutate={mutateOpenKeys} />;
                })}
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  {openKeys?.length === 0 && <KeyRoundIcon className="size-8 text-gray-500" />}
                  <Button variant="secondary" onClick={generateOpenKeyFun} className="cursor-pointer p-4">
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
                  className="mx-auto my-2 block size-20 shrink-0 cursor-pointer bg-[#00000010] text-black"
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
                <div
                  className={`mt-4 flex w-full cursor-pointer items-center justify-center rounded-md bg-black px-3 py-2 text-center font-semibold text-white duration-300 active:scale-95 ${
                    profileEditing ? 'bg-gray-700' : 'bg-black'
                  }`}
                  onClick={() => {
                    if (!profileEditing) {
                      saveProfile();
                    }
                  }}
                >
                  {profileEditing && <Loader className="mr-2 size-4 animate-spin" />}
                  {profileEditing ? t('editing') : t('save')}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isAvatarModalOpen} onOpenChange={setIsAvatarModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('cropAvatar')}</DialogTitle>
            </DialogHeader>
            <AvatarEditor
              ref={AvatarEditorRef}
              className="mx-auto"
              image={editProfile.avatar_file}
              width={150}
              height={150}
              border={50}
              color={[0, 0, 0, 0.6]}
              scale={1}
              rotate={0}
            />
            <div
              className={`mt-4 w-full cursor-pointer rounded-md bg-black px-3 py-2 text-center font-semibold text-white duration-300 active:scale-95 ${
                avatarUploading ? 'bg-gray-700' : 'bg-black'
              }`}
              onClick={() => {
                if (!avatarUploading) {
                  avatarEditSave();
                }
              }}
            >
              {avatarUploading && <Loader className="mr-2 size-4 animate-spin" />}
              {avatarUploading ? t('uploading') : t('done')}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ContainerWithSideBar>
  );
}

export default ProfilePage;
