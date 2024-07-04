import { apiGetUserInfoByUsername } from "@/api/user/main";
import { UserOutlined, GlobalOutlined } from "@ant-design/icons";
import { Avatar } from "antd";
import moment from "moment";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGetUserPublicRote } from "@/api/rote/main";
import { useTempRotes, useTempRotesDispatch } from "@/state/tempRotes";
import Linkify from "react-linkify";
import RoteList from "@/components/roteList";
import GoTop from "@/components/goTop";
import NavBar from "@/components/navBar";
import { Helmet } from "react-helmet-async";
import NavHeader from "@/components/navHeader";

function UserPage() {
  const navigate = useNavigate();
  const { username }: any = useParams();
  const [userInfo, setUserInfo] = useState<any>(null);

  // const { t } = useTranslation("translation", { keyPrefix: "pages.mine" });

  useEffect(() => {
    apiGetUserInfoByUsername(username)
      .then((res) => {
        setUserInfo(res.data.data);
      })
      .catch(() => {
        navigate("/404");
      });
  }, []);

  return (
    <div>
      <Helmet>
        <title>
          {userInfo?.nickname || userInfo?.username || "loading..."}
        </title>
        <meta
          name="description"
          content={userInfo?.description || "rote.ink"}
        />
      </Helmet>

      <NavBar />
      <div
        className={` scrollContainer scroll-smooth overscroll-contain flex-1 noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative`}
      >
        <div
          id="top"
          className=" w-full min-h-[1/5] max-h-80 relative overflow-hidden"
        >
          <img
            className=" w-full h-full min-h-20"
            src={userInfo?.cover || require("@/assets/img/defaultCover.png")}
            alt=""
          />
        </div>
        <div className=" flex mx-4 h-16">
          <Avatar
            className=" translate-y-[-50%] bg-white border-bgWhite border-[4px] bg-[#00000010] text-black shrink-0 sm:block"
            size={{ xs: 80, sm: 80, md: 80, lg: 100, xl: 120, xxl: 150 }}
            icon={<UserOutlined className=" text-[#00000010]" />}
            src={userInfo?.avatar}
          />
        </div>
        <div className=" flex flex-col mx-4 gap-1">
          <div className=" text-2xl font-semibold">{userInfo?.nickname}</div>
          <div className=" text-base text-gray-500">@{userInfo?.username}</div>
          <div className=" text-base ">
            <div className=" aTagStyle break-words whitespace-pre-line">
              <Linkify>
                {(userInfo?.description as any) ||
                  "这个人很懒，还没留下任何简介..."}
              </Linkify>
            </div>
          </div>
          <div className=" text-base text-gray-500">{`注册时间：${moment
            .utc(userInfo?.createdAt)
            .format("YYYY/MM/DD HH:mm:ss")}`}</div>
        </div>

        <NavHeader
          title="已公开的笔记 / Public Note"
          icon={<GlobalOutlined />}
        />

        {userInfo && (
          <RoteList
            rotesHook={useTempRotes}
            rotesDispatchHook={useTempRotesDispatch}
            api={apiGetUserPublicRote}
            apiProps={{
              limit: 20,
              username,
              filter: {},
            }}
          />
        )}

        <GoTop scrollContainerName="scrollContainer" />
      </div>
    </div>
  );
}

export default UserPage;
