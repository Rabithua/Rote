import { apiGenerateOpenKey, apiGetMyOpenKey } from "@/api/rote/main";
import OpenKeyItem from "@/components/openKey";
import { useOpenKeys, useOpenKeysDispatch } from "@/state/openKeys";
import { useProfile, useProfileDispatch } from "@/state/profile";
import { EditOutlined, LoadingOutlined, UserOutlined } from "@ant-design/icons";
import { Avatar, Divider, Input, Modal, Typography } from "antd";
import TextArea from "antd/es/input/TextArea";
import moment from "moment";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import AvatarEditor from "react-avatar-editor";
import { apiSaveProfile, apiUploadAvatar } from "@/api/user/main";

function ProfilePage() {
  const inputAvatarRef = useRef(null);
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
    const toastId = toast.loading("创建中...");
    apiGenerateOpenKey()
      .then((res: any) => {
        console.log(res);
        openKeysDispatch({
          type: "addOne",
          openKey: res.data.data,
        });
        toast.success("创建成功", {
          id: toastId,
        });
      })
      .catch(() => {
        toast.error("创建失败", {
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
              "file",
              new File([blob], "cropped_image.png", {
                type: "image/png",
              })
            );
            apiUploadAvatar(formData).then((res) => {
              console.log(res);
              setEditProfile({
                ...editProfile,
                avatar: res.data.data[0].url,
              });
              setAvatarUploading(false);
              setIsAvatarModalOpen(false);
              toast.success("上传成功");
            });
          } catch (error) {
            toast.error("上传失败");
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
        toast.success("修改成功");
        profileDispatch({
          type: "updateProfile",
          profile: res.data.data,
        });
        setIsModalOpen(false);
        setProfileEditing(false);
      })
      .catch((err) => {
        toast.error("修改失败");
        setIsModalOpen(false);
        setProfileEditing(false);
        console.error("Error edit Profile:", err);
      });
  }

  return (
    <div>
      <div className=" w-full max-h-80 relative overflow-hidden">
        {profile?.cover ? (
          <img className=" w-full h-full" src={profile?.cover} alt="" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 40"
            fill="none"
          >
            <g clipPath="url(#clip0_2027_1853)">
              <rect width="100" height="40" fill="white" />
              <rect
                x="61"
                y="23"
                width="28.7687"
                height="28.7687"
                rx="14.3844"
                fill="white"
              />
              <path
                d="M91 28.3739V30.4495C91 31.1582 90.8497 31.86 90.5575 32.5147C90.2654 33.1695 89.8372 33.7644 89.2974 34.2655C88.7576 34.7666 88.1168 35.1641 87.4115 35.4353C86.7063 35.7065 85.9504 35.8461 85.187 35.8461H82.9512V39.9973H81.1626V34.1856L81.1796 33.3554C81.2922 32 81.9517 30.734 83.0263 29.8104C84.1008 28.8869 85.5113 28.3739 86.9756 28.3739H91ZM76.691 25.053C78.0051 25.0531 79.2858 25.4368 80.352 26.1499C81.4182 26.863 82.2158 27.8694 82.6319 29.0265C81.9476 29.5649 81.3869 30.2256 80.9833 30.9693C80.5797 31.713 80.3414 32.5244 80.2826 33.3554H79.374C77.7137 33.3554 76.1213 32.7431 74.9473 31.6532C73.7733 30.5633 73.1138 29.0851 73.1138 27.5437V25.053H76.691Z"
                fill="#07C160"
                fillOpacity="0.06"
              />
            </g>
            <defs>
              <clipPath id="clip0_2027_1853">
                <rect width="100" height="40" fill="white" />
              </clipPath>
            </defs>
          </svg>
        )}
      </div>
      <div className=" flex mx-4 h-16">
        <Avatar
          className=" translate-y-[-50%] bg-white border-bgWhite border-[4px] bg-[#00000010] text-black shrink-0 sm:block"
          size={{ xs: 80, sm: 80, md: 80, lg: 100, xl: 120, xxl: 150 }}
          icon={<UserOutlined className=" text-[#00000030]" />}
          src={profile?.avatar}
        />
        <div
          className=" mt-auto h-fit cursor-pointer select-none ml-auto duration-300 flex items-center gap-2 bg-black text-white px-4 py-1 rounded-md active:scale-95"
          onClick={() => {
            setIsModalOpen(true);
          }}
        >
          <EditOutlined />
          编辑资料
        </div>
      </div>
      <div className=" flex flex-col mx-4 gap-1">
        <div className=" text-2xl font-semibold">{profile?.nickname}</div>
        <div className=" text-base text-gray-500">@{profile?.username}</div>
        <div className=" text-base ">
          {profile?.description || "这个人很懒，还没留下任何简介..."}
        </div>
        <div className=" text-base text-gray-500">{`注册时间：${moment
          .utc(profile?.createdAt)
          .format("YYYY/MM/DD HH:mm:ss")}`}</div>
      </div>
      <Divider />
      <div className=" text-2xl font-semibold m-4">
        OpenKey <br />
        <div className=" font-normal mt-2 text-sm text-gray-500">
          OpenKey 可以轻易的使用权限指定的功能，合理分配权限，避免 OpenKey
          泄露带来不必要的麻烦。
        </div>
      </div>
      <div className=" flex flex-col">
        {openKeyLoading ? (
          <div className=" flex justify-center items-center py-8 gap-3 bg-white">
            <LoadingOutlined />
            <div>加载中...</div>
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
              className=" cursor-pointer p-4 bg-white border-[#00000010] border-t-[1px]"
            >
              <div className=" break-all mr-auto font-semibold font-mono">
                {openKeys.length === 0
                  ? "暂时还没有OpenKey，新建一个？"
                  : "添加一个OpenKey"}
              </div>
            </div>
          </>
        )}
      </div>
      <Modal
        title="编辑资料"
        open={isModalOpen}
        onCancel={onModelCancel}
        maskClosable={true}
        destroyOnClose={true}
        footer={null}
      >
        <div className=" cursor-default bg-white w-full flex gap-5">
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
              邮箱
            </Typography.Title>
            <Input
              disabled
              className=" text-lg w-full rounded-md font-mono border-[2px]"
              maxLength={20}
              value={editProfile.email}
            />
            <Typography.Title className=" mt-2" level={5}>
              用户名
            </Typography.Title>
            <Input
              disabled
              className=" text-lg w-full rounded-md font-mono border-[2px]"
              maxLength={20}
              value={editProfile.username}
            />
            <Typography.Title className=" mt-2" level={5}>
              昵称
            </Typography.Title>
            <Input
              placeholder="输入你的昵称..."
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
              简介
            </Typography.Title>
            <TextArea
              placeholder="输入你的简介..."
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
              {profileEditing ? "修改中..." : "保存"}
            </div>
          </div>
        </div>
      </Modal>
      <Modal
        title="剪裁头像"
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
          className=" mx-auto border-[2px]"
          image={editProfile.avatar_file}
          width={150}
          height={150}
          border={50}
          color={[0, 0, 0, 0.6]} // RGBA
          scale={1}
          rotate={0}
        />
        <div
          className={` mt-4 cursor-pointer duration-300 active:scale-95  border w-full text-center rounded-md px-3 py-2 bg-black text-white font-semibold ${
            avatarUploading ? " bg-gray-700" : "bg-black"
          }`}
          onClick={() => {
            if (!avatarUploading) {
              avatarEditSave();
            }
          }}
        >
          {avatarUploading && <LoadingOutlined className=" mr-2" />}
          {avatarUploading ? "上传中..." : "完成"}
        </div>
      </Modal>
    </div>
  );
}

export default ProfilePage;
