import { apiGenerateOpenKey, apiGetMyOpenKey } from "@/api/rote/main";
import OpenKeyItem from "@/components/openKey";
import { useOpenKeys, useOpenKeysDispatch } from "@/state/openKeys";
import { useProfile } from "@/state/profile";
import { EditOutlined, LoadingOutlined, UserOutlined } from "@ant-design/icons";
import { Avatar, Divider } from "antd";
import moment from "moment";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

function ProfilePage() {
  const profile = useProfile();
  const openKeys = useOpenKeys();
  const openKeysDispatch = useOpenKeysDispatch();
  const [openKeyLoading, setOpenKeyLoading] = useState(true);

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

  return (
    <div>
      <div className=" w-full max-h-80 overflow-hidden">
        {profile?.cover ? (
          <img src={profile?.cover} alt="" />
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
        <div className=" mt-auto h-fit cursor-pointer select-none ml-auto duration-300 flex items-center gap-2 bg-black text-white px-4 py-1 rounded-md active:scale-95">
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
            {openKeys.length === 0 && (
              <div
                onClick={generateOpenKeyFun}
                className=" cursor-pointer p-4 bg-white border-[#00000010] border-t-[1px]"
              >
                <div className=" break-all mr-auto font-semibold font-mono">
                  暂时还没有OpenKey，新建一个？
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
