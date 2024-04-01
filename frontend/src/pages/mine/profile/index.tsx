import { apiGetMySessions } from "@/api/rote/main";
import { useProfile } from "@/state/profile";
import { EditOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Avatar } from "antd";
import moment from "moment";
import { useEffect, useState } from "react";

function ProfilePage() {
  const profile = useProfile();
  const [sessions, setSessions] = useState<any>([]);

  useEffect(() => {
    apiGetMySessions()
      .then((res: any) => {
        console.log(res);
        setSessions(res.data.data);
      })
      .catch();
  }, []);

  return (
    <div>
      <div className=" w-full max-h-80 overflow-hidden">
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
      </div>
      <div className=" flex mx-4 h-16">
        <Avatar
          className=" translate-y-[-50%] bg-white border-bgWhite border-[4px] bg-[#00000010] text-black shrink-0 sm:block"
          size={{ xs: 80, sm: 80, md: 80, lg: 120, xl: 150, xxl: 200 }}
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
        <div className=" text-base ">这个人很懒，还没留下任何简介...</div>
        <div className=" text-base text-gray-500">{`注册时间：${moment
          .utc(profile?.createdAt)
          .format("YYYY/MM/DD HH:mm:ss")}`}</div>
      </div>
      {sessions.length > 0 && (
        <>
          <div className=" text-2xl font-semibold m-4">Session</div>
          <Alert
            className=" m-2"
            type="warning"
            showIcon
            message="Session 拥有账户的所有权限，请谨慎保管"
          />
          <div className=" flex flex-col">
            {sessions.map((session: any, index: any) => {
              return (
                <div
                  key={`session_${index}`}
                  className="  flex p-4 flex-wrap border-[#00000010] border-t-[1px]"
                >
                  <div className=" break-all text-red-700 mr-auto font-semibold font-mono">
                    {session.sid}
                  </div>
                  <div className=" text-gray-500 flex gap-2 text-sm">
                    {moment.utc(session?.expiresAt).format("YYYY/MM/DD HH:mm")}
                    <div>前有效</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default ProfilePage;
