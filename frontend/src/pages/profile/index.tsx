import { apiGenerateOpenKey, apiGetMyOpenKey } from "@/api/rote/main";
import { apiSaveProfile, apiUploadAvatar } from "@/api/user/main";
import OpenKeyItem from "@/components/openKey";
import { useOpenKeys, useOpenKeysDispatch } from "@/state/openKeys";
import { useProfile, useProfileDispatch } from "@/state/profile";
import {
  EditOutlined,
  LoadingOutlined,
  RetweetOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Divider, Input, Modal, Typography } from "antd";
import TextArea from "antd/es/input/TextArea";
import moment from "moment";
import { useEffect, useRef, useState } from "react";
import AvatarEditor from "react-avatar-editor";
import toast from "react-hot-toast";
import Linkify from "react-linkify";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

function ProfilePage() {
  const { t } = useTranslation("translation", { keyPrefix: "pages.profile" });
  const inputAvatarRef = useRef(null);
  const inputCoverRef = useRef(null);
  const AvatarEditorRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState<boolean>(false);
  const profile = useProfile();
  const profileDispatch = useProfileDispatch();
  const [editProfile, setEditProfile] = useState<any>(profile);
  const openKeys = useOpenKeys();
  const openKeysDispatch = useOpenKeysDispatch();
  const [openKeyLoading, setOpenKeyLoading] = useState(true);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);

  useEffect(() => {
    apiGetMyOpenKey()
      .then((res: any) => {
        openKeysDispatch({
          type: "init",
          openKeys: res.data.data,
        });
        setOpenKeyLoading(false);
      })
      .catch(() => {
        setOpenKeyLoading(false);
      });
  }, []);

  function generateOpenKeyFun() {
    const toastId = toast.loading(t("creating"));
    apiGenerateOpenKey()
      .then((res: any) => {
        console.log(res);
        openKeysDispatch({
          type: "addOne",
          openKey: res.data.data,
        });
        toast.success(t("createSuccess"), {
          id: toastId,
        });
      })
      .catch(() => {
        toast.error(t("createFailed"), {
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
              "images",
              new File([blob], "cropped_image.png", {
                type: "image/png",
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
              toast.success(t("uploadSuccess"));
            });
          } catch (error) {
            toast.error(t("uploadFailed"));
            setAvatarUploading(false);
            console.error("Error uploading image:", error);
          }
        });
    }
  }

  function saveProfile() {
    setProfileEditing(true);
    apiSaveProfile(editProfile)
      .then((res) => {
        toast.success(t("editSuccess"));
        profileDispatch({
          type: "updateProfile",
          profile: res.data.data,
        });
        setIsModalOpen(false);
        setProfileEditing(false);
      })
      .catch((err) => {
        toast.error(t("editFailed"));
        setIsModalOpen(false);
        setProfileEditing(false);
        console.error("Error edit Profile:", err);
      });
  }

  function changeCover(event: any) {
    const toastId = toast.loading(t("uploading"));
    const selectedFile = event.target.files[0];

    if (selectedFile) {
      const formData = new FormData();
      formData.append("images", selectedFile);

      apiUploadAvatar(formData).then((res) => {
        console.log(res);
        let url = res.data.data[0].compressUrl || res.data.data[0].url;

        apiSaveProfile({
          cover: url,
        })
          .then((res) => {
            toast.success(t("editSuccess"), {
              id: toastId,
            });
            profileDispatch({
              type: "updateProfile",
              profile: res.data.data,
            });
          })
          .catch((err) => {
            toast.error(t("editFailed"), {
              id: toastId,
            });
            console.error("Error edit Profile:", err);
          });
      });
    }
  }

  return (
    <div>
      <div className=" w-full min-h-[1/5] max-h-80 relative overflow-hidden">
        <img
          className=" w-full h-full min-h-20"
          src={profile?.cover || require("@/assets/img/defaultCover.png")}
          alt=""
        />
        <div
          className=" cursor-pointer absolute bottom-1 right-3 text-white px-2 py-1 rounded-md bg-[#00000030] backdrop-blur-md"
          onClick={() => {
            // @ts-ignore
            inputCoverRef.current?.click();
          }}
        >
          <input
            type="file"
            accept="image/*"
            max="1"
            className=" hidden"
            ref={inputCoverRef}
            onChange={changeCover}
          />
          <RetweetOutlined />
        </div>
      </div>
      <div className=" flex mx-4 h-16">
        <Avatar
          className=" translate-y-[-50%] bg-bgLight dark:bg-bgDark border-bgLight border-[4px] bg-opacityLight dark:bg-opacityDark text-black shrink-0 sm:block"
          size={{ xs: 80, sm: 80, md: 80, lg: 100, xl: 120, xxl: 120 }}
          icon={<UserOutlined className=" text-[#00000010]" />}
          src={profile?.avatar}
        />
        <div
          className=" mt-auto h-fit cursor-pointer select-none ml-auto duration-300 flex items-center gap-2 bg-bgDark text-textDark dark:bg-bgLight dark:text-textLight px-4 py-1 rounded-md active:scale-95"
          onClick={() => {
            setIsModalOpen(true);
          }}
        >
          <EditOutlined />
          {t("editProfile")}
        </div>
      </div>
      <div className=" flex flex-col mx-4 gap-1">
        <Link to={`/${profile?.username}`}>
          <h1 className=" hover:underline w-fit text-2xl font-semibold">
            {profile?.nickname}
          </h1>
          <h2 className=" hover:underline w-fit text-base text-gray-500">
            @{profile?.username}
          </h2>
        </Link>
        <div className=" text-base ">
          <div className=" aTagStyle break-words whitespace-pre-line">
            <Linkify>
              {(profile?.description as any) || t("noDescription")}
            </Linkify>
          </div>
        </div>
        <div className=" text-base text-gray-500">
          {t("registerTime")}
          {moment.utc(profile?.createdAt).format("YYYY/MM/DD HH:mm:ss")}
        </div>
      </div>
      <Divider />
      <div className=" text-2xl font-semibold m-4">
        OpenKey <br />
        <div className=" font-normal mt-2 text-sm text-gray-500">
          {t("openKeyDescription")}
        </div>
      </div>
      <div className=" flex flex-col">
        {openKeyLoading ? (
          <div className=" flex justify-center items-center py-8 gap-3 bg-bgLight dark:bg-bgDark">
            <LoadingOutlined />
            <div>{t("loading")}</div>
          </div>
        ) : (
          <>
            {openKeys.map((openKey: any, index: any) => {
              return (
                <OpenKeyItem
                  key={`openKey_${openKey.id}`}
                  openKey={openKey}
                ></OpenKeyItem>
              );
            })}
            <div
              onClick={generateOpenKeyFun}
              className=" text-primary cursor-pointer p-4 bg-bgLight dark:bg-bgDark  border-t-[1px] border-opacityLight dark:border-opacityDark"
            >
              <div className=" break-all mr-auto font-semibold font-mono">
                {openKeys.length === 0 ? t("noOpenKey") : t("addOpenKey")}
              </div>
            </div>
          </>
        )}
      </div>
      <Modal
        title={t("editProfile")}
        open={isModalOpen}
        onCancel={onModelCancel}
        maskClosable={true}
        destroyOnClose={true}
        footer={null}
      >
        <div className=" cursor-default w-full flex gap-5">
          <div className=" flex flex-col gap-1 w-full">
            <input
              type="file"
              accept="image/*"
              max="1"
              className=" hidden"
              ref={inputAvatarRef}
              onChange={handleFileChange}
            />
            <Avatar
              className=" cursor-pointer bg-[#00000010] mx-auto my-2 text-black shrink-0 block"
              size={{ xs: 60, sm: 60, md: 80, lg: 80, xl: 80, xxl: 80 }}
              icon={<UserOutlined className=" text-[#00000030]" />}
              src={editProfile.avatar}
              onClick={() => {
                //@ts-ignore
                inputAvatarRef.current?.click();
              }}
            />

            <Typography.Title className=" mt-2" level={5}>
              {t("email")}
            </Typography.Title>
            <Input
              disabled
              className=" text-lg w-full rounded-md font-mono border-[2px]"
              maxLength={20}
              value={editProfile.email}
            />
            <Typography.Title className=" mt-2" level={5}>
              {t("username")}
            </Typography.Title>
            <Input
              disabled
              className=" text-lg w-full rounded-md font-mono border-[2px]"
              maxLength={20}
              value={editProfile.username}
            />
            <Typography.Title className=" mt-2" level={5}>
              {t("nickname")}
            </Typography.Title>
            <Input
              placeholder={t("enterNickname")}
              className=" text-lg w-full rounded-md font-mono border-[2px]"
              maxLength={20}
              value={editProfile.nickname}
              onInput={(e) => {
                setEditProfile({
                  ...editProfile,
                  nickname: e.currentTarget.value,
                });
              }}
            />
            <Typography.Title className=" mt-2" level={5}>
              {t("description")}
            </Typography.Title>
            <TextArea
              placeholder={t("enterDescription")}
              className=" text-lg w-full rounded-md border-[2px]"
              maxLength={300}
              value={editProfile.description}
              style={{ height: 120, resize: "none" }}
              onInput={(e) => {
                setEditProfile({
                  ...editProfile,
                  description: e.currentTarget.value,
                });
              }}
            />

            <div
              className={` mt-4 cursor-pointer duration-300 active:scale-95  border w-full text-center rounded-md px-3 py-2 bg-black text-white font-semibold ${
                profileEditing ? " bg-gray-700" : "bg-black"
              }`}
              onClick={() => {
                if (!profileEditing) {
                  saveProfile();
                }
              }}
            >
              {profileEditing && <LoadingOutlined className=" mr-2" />}
              {profileEditing ? t("editing") : t("save")}
            </div>
          </div>
        </div>
      </Modal>
      <Modal
        title={t("cropAvatar")}
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
          className=" mx-auto border-[2px] border-opacityLight dark:border-opacityDark"
          image={editProfile.avatar_file}
          width={150}
          height={150}
          border={50}
          color={[0, 0, 0, 0.6]} // RGBA
          scale={1}
          rotate={0}
        />
        <div
          className={` mt-4 cursor-pointer duration-300 active:scale-95  border border-opacityLight dark:border-opacityDark w-full text-center rounded-md px-3 py-2 bg-black text-white font-semibold ${
            avatarUploading ? " bg-gray-700" : "bg-black"
          }`}
          onClick={() => {
            if (!avatarUploading) {
              avatarEditSave();
            }
          }}
        >
          {avatarUploading && <LoadingOutlined className=" mr-2" />}
          {avatarUploading ? t("uploading") : t("done")}
        </div>
      </Modal>
    </div>
  );
}

export default ProfilePage;
