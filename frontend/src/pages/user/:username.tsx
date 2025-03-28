import { apiGetUserPublicRote } from "@/api/rote/main";
import { apiGetUserInfoByUsername } from "@/api/user/main";
import GoTop from "@/components/goTop";
import NavBar from "@/components/navBar";
import NavHeader from "@/components/navHeader";
import RoteList from "@/components/roteList";
import { Profile } from "@/types/main";
import { useAPIGet } from "@/utils/fetcher";
import { Avatar } from "antd";
import { Globe2, Loader, User } from "lucide-react";
import moment from "moment";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import Linkify from "react-linkify";
import { useNavigate, useParams } from "react-router-dom";

function UserPage() {
  const { t } = useTranslation("translation", { keyPrefix: "pages.user" });
  const navigate = useNavigate();
  const { username }: any = useParams();
  const { data: userInfo, error, isLoading } = useAPIGet<Profile>(
    username,
    apiGetUserInfoByUsername,
    {
      onError: (err) => {
        if (err.response?.status === 404 || err.response?.status === 500) {
          navigate("/404");
        }
      },
    },
  );

  return isLoading
    ? (
      <div className=" h-dvh w-screen dark:text-white flex justify-center items-center">
        <Loader className=" animate-spin size-8 text-4xl" />
      </div>
    )
    : (
      <>
        <Helmet>
          <title>
            {userInfo?.nickname || userInfo?.username || t("helmet.loading")}
          </title>
          <meta
            name="description"
            content={userInfo?.description || t("helmet.defaultDesc")}
          />
        </Helmet>

        <NavBar />
        <div
          className={`flex-1 noScrollBar overflow-y-visible overflow-x-hidden relative`}
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
              className=" translate-y-[-50%] bg-bgLight dark:bg-bgDark border-opacityLight dark:border-opacityDark border-[4px] shrink-0 sm:block"
              size={{ xs: 80, sm: 80, md: 80, lg: 100, xl: 120, xxl: 120 }}
              icon={<User className=" size-4 text-[#00000010]" />}
              src={userInfo?.avatar}
            />
          </div>
          <div className=" flex flex-col mx-4 gap-1">
            <div className=" text-2xl font-semibold">{userInfo?.nickname}</div>
            <div className=" text-base text-gray-500">
              @{userInfo?.username}
            </div>
            <div className=" text-base ">
              <div className=" aTagStyle break-words whitespace-pre-line">
                <Linkify>
                  {(userInfo?.description as any) || t("noDescription")}
                </Linkify>
              </div>
            </div>
            <div className=" text-base text-gray-500">
              {`${
                t(
                  "registerTime",
                )
              }${
                moment
                  .utc(userInfo?.createdAt)
                  .format("YYYY/MM/DD HH:mm:ss")
              }`}
            </div>
          </div>

          <NavHeader
            title={t("publicNotes")}
            icon={<Globe2 className="size-6" />}
          />

          {userInfo && (
            <RoteList
              api={apiGetUserPublicRote}
              apiProps={{
                limit: 20,
                username,
                filter: {},
              }}
            />
          )}

          <GoTop />
        </div>
      </>
    );
}

export default UserPage;
