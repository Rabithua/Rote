import { apiGenerateOpenKey, apiGetMyOpenKey } from '@/api/rote/main';
import { apiSaveProfile, apiUploadAvatar, getMyProfile } from '@/api/user/main';
import LoadingPlaceholder from '@/components/LoadingPlaceholder';
import NavHeader from '@/components/navHeader';
import OpenKeyItem from '@/components/openKey';
import RssBlock from '@/components/Rss';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import { useOpenKeys } from '@/state/openKeys';
import { Profile } from '@/types/main';
import { useAPIGet } from '@/utils/fetcher';
import { Avatar, Divider, Input, Modal, Typography } from 'antd';
import TextArea from 'antd/es/input/TextArea';
import { Edit, Loader, LoaderPinwheel, Rss, Stars, User, UserCircle2 } from 'lucide-react';
import moment from 'moment';
import { useEffect, useRef, useState } from 'react';
import AvatarEditor from 'react-avatar-editor';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Linkify from 'react-linkify';
import { Link } from 'react-router-dom';

function ProfilePage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.profile' });
  const inputAvatarRef = useRef(null);
  const inputCoverRef = useRef(null);
  const AvatarEditorRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState<boolean>(false);
  const [coverChangeing, setCoverChangeing] = useState(false);

  const { data: profile, mutate } = useAPIGet<Profile>('profile', getMyProfile);
  const [editProfile, setEditProfile] = useState<any>(profile);
  const [openKeys, setOpenKeys] = useOpenKeys();
  const [openKeyLoading, setOpenKeyLoading] = useState(true);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);

  useEffect(() => {
    apiGetMyOpenKey()
      .then((res: any) => {
        setOpenKeys(res.data.data);
        setOpenKeyLoading(false);
      })
      .catch(() => {
        setOpenKeyLoading(false);
      });
  }, [setOpenKeys]);

  function generateOpenKeyFun() {
    const toastId = toast.loading(t('creating'));
    apiGenerateOpenKey()
      .then((res: any) => {
        setOpenKeys([...openKeys, res.data.data]);
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

  function onModelCancel() {
    setIsModalOpen(false);
    setEditProfile(profile);
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
            apiUploadAvatar(formData).then((res) => {
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
    apiSaveProfile(editProfile)
      .then((res) => {
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

      apiUploadAvatar(formData).then((res) => {
        console.log(res);
        let url = res.data.data[0].compressUrl || res.data.data[0].url;

        apiSaveProfile({
          cover: url,
        })
          .then((res) => {
            mutate();
            setCoverChangeing(false);
          })
          .catch((err) => {
            console.error('Error edit Profile:', err);
            setCoverChangeing(false);
          });
      });
    }
  }

  const SideBar = () => {
    return (
      <div className="grid grid-cols-3">
        <a
          href={`${process.env.REACT_APP_BASEURL_PRD || 'http://localhost:3000'}/v1/api/rss/${profile?.username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="dark:bg-primaryDark/10 dark:hover:bg-primaryDark/20 flex cursor-pointer items-center justify-center gap-2 border-[0.5px] bg-primary/10 py-4 text-primary hover:text-primary/80"
        >
          <Rss className="size-5" />
          <div className="text-xl">RSS</div>
        </a>
        <div className="flex items-center justify-center gap-2 border-[0.5px] py-4">
          <div className="text-xl">☝️</div>
        </div>
        <div className="flex items-center justify-center gap-2 border-[0.5px] py-4">
          <div className="text-xl">🤓</div>
        </div>
      </div>
    );
  };

  return (
    <ContainerWithSideBar
      sidebar={<SideBar />}
      sidebarHeader={
        <div className="flex items-center gap-2 border-b p-4 text-lg font-semibold">
          <div className="flex h-8 items-center gap-2">
            <Stars className="size-5" />
            {t('sideBarTitle')}
          </div>
        </div>
      }
    >
      <div className="pb-20">
        <NavHeader title={t('title')} icon={<UserCircle2 className="size-8" />} />
        <div className="relative aspect-3 w-full overflow-hidden">
          <img
            className="h-full min-h-20 w-full object-cover"
            src={profile?.cover || require('@/assets/img/defaultCover.png')}
            alt=""
          />
          <div
            className="absolute bottom-1 right-3 cursor-pointer rounded-md bg-[#00000030] px-2 py-1 text-white backdrop-blur-md"
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
            className="shrink-0 translate-y-[-50%] border-[4px] border-bgLight bg-bgLight bg-opacityLight text-black sm:block dark:bg-bgDark dark:bg-opacityDark"
            size={{ xs: 80, sm: 80, md: 80, lg: 100, xl: 120, xxl: 120 }}
            icon={<User className="size-4 text-[#00000010]" />}
            src={profile?.avatar}
          />
          <div
            className="ml-auto mt-auto flex h-fit cursor-pointer select-none items-center gap-2 rounded-md bg-bgDark px-4 py-1 text-textDark duration-300 active:scale-95 dark:bg-bgLight dark:text-textLight"
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
            <h2 className="w-fit text-base text-gray-500 hover:underline">@{profile?.username}</h2>
          </Link>
          <div className="text-base">
            <div className="aTagStyle whitespace-pre-line break-words">
              <Linkify>{(profile?.description as any) || t('noDescription')}</Linkify>
            </div>
          </div>
          <div className="text-base text-gray-500">
            {t('registerTime')}
            {moment.utc(profile?.createdAt).format('YYYY/MM/DD HH:mm:ss')}
          </div>
        </div>
        <Divider />
        <div className="m-4 text-2xl font-semibold">
          OpenKey <br />
          <div className="mt-2 text-sm font-normal text-gray-500">{t('openKeyDescription')}</div>
        </div>
        <div className="flex flex-col">
          {openKeyLoading ? (
            <LoadingPlaceholder className="py-8" size={6} />
          ) : (
            <>
              {openKeys.map((openKey: any, index: any) => {
                return <OpenKeyItem key={openKey.id} openKey={openKey}></OpenKeyItem>;
              })}
              <div
                onClick={generateOpenKeyFun}
                className="cursor-pointer border-t-[1px] border-opacityLight bg-bgLight p-4 text-primary dark:border-opacityDark dark:bg-bgDark"
              >
                <div className="mr-auto break-all font-mono font-semibold">
                  {openKeys.length === 0 ? t('noOpenKey') : t('addOpenKey')}
                </div>
              </div>
            </>
          )}
        </div>
        <Modal
          title={t('editProfile')}
          open={isModalOpen}
          onCancel={onModelCancel}
          maskClosable={true}
          destroyOnClose={true}
          footer={null}
        >
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
              <Avatar
                className="mx-auto my-2 block shrink-0 cursor-pointer bg-[#00000010] text-black"
                size={{ xs: 60, sm: 60, md: 80, lg: 80, xl: 80, xxl: 80 }}
                icon={<User className="size-4 text-[#00000030]" />}
                src={editProfile.avatar}
                onClick={() => {
                  //@ts-ignore
                  inputAvatarRef.current?.click();
                }}
              />

              <Typography.Title className="mt-2" level={5}>
                {t('email')}
              </Typography.Title>
              <Input
                disabled
                className="w-full rounded-md border-[2px] font-mono text-lg"
                maxLength={20}
                value={editProfile.email}
              />
              <Typography.Title className="mt-2" level={5}>
                {t('username')}
              </Typography.Title>
              <Input
                disabled
                className="w-full rounded-md border-[2px] font-mono text-lg"
                maxLength={20}
                value={editProfile.username}
              />
              <Typography.Title className="mt-2" level={5}>
                {t('nickname')}
              </Typography.Title>
              <Input
                placeholder={t('enterNickname')}
                className="w-full rounded-md border-[2px] font-mono text-lg"
                maxLength={20}
                value={editProfile.nickname}
                onInput={(e) => {
                  setEditProfile({
                    ...editProfile,
                    nickname: e.currentTarget.value,
                  });
                }}
              />
              <Typography.Title className="mt-2" level={5}>
                {t('description')}
              </Typography.Title>
              <TextArea
                placeholder={t('enterDescription')}
                className="w-full rounded-md border-[2px] text-lg"
                maxLength={300}
                value={editProfile.description}
                style={{ height: 120, resize: 'none' }}
                onInput={(e) => {
                  setEditProfile({
                    ...editProfile,
                    description: e.currentTarget.value,
                  });
                }}
              />

              <div
                className={`mt-4 flex w-full cursor-pointer items-center justify-center rounded-md border bg-black px-3 py-2 text-center font-semibold text-white duration-300 active:scale-95 ${
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
        </Modal>
        <Modal
          title={t('cropAvatar')}
          open={isAvatarModalOpen}
          onCancel={() => {
            setIsAvatarModalOpen(false);
          }}
          maskClosable={true}
          destroyOnClose={true}
          footer={null}
        >
          <AvatarEditor
            ref={AvatarEditorRef}
            className="mx-auto border-[2px] border-opacityLight dark:border-opacityDark"
            image={editProfile.avatar_file}
            width={150}
            height={150}
            border={50}
            color={[0, 0, 0, 0.6]} // RGBA
            scale={1}
            rotate={0}
          />
          <div
            className={`mt-4 w-full cursor-pointer rounded-md border border-opacityLight bg-black px-3 py-2 text-center font-semibold text-white duration-300 active:scale-95 dark:border-opacityDark ${
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
        </Modal>
      </div>
    </ContainerWithSideBar>
  );
}

export default ProfilePage;
