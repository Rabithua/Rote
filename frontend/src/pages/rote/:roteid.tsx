import { apiGetSingleRote } from "@/api/rote/main";
import NavBar from "@/components/navBar";
import RoteItem from "@/components/roteItem";

import { Rote } from "@/types/main";
import { useAPIGet } from "@/utils/fetcher";
import Avatar from "antd/es/avatar";
import { Loader, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";

function SingleRotePage() {
  const { t } = useTranslation("translation", { keyPrefix: "pages.rote" });
  const navigate = useNavigate();
  const { roteid } = useParams();
  const [msg] = useState(null);

  const { data: rote, isLoading, error } = useAPIGet<Rote>(
    roteid || "",
    apiGetSingleRote,
  );

  useEffect(() => {
    if (!roteid) {
      navigate("/404");
    }
  }, [roteid, navigate]);

  if (!roteid) {
    return null;
  }

  return (
    <div
      className={`flex-1 noScrollBar overflow-y-visible overflow-x-hidden relative pb-20`}
    >
      <NavBar />
      {isLoading
        ? (
          <div className=" flex justify-center text-lg items-center py-8 gap-3 bg-bgLight dark:bg-bgDark">
            <Loader className="size-6 animate-spin" />
          </div>
        )
        : rote
        ? (
          <>
            <div className=" flex flex-col items-center">
              <div></div>
              <RoteItem rote={rote} />
            </div>
            {rote.author && (
              <Link to={`/${rote.author.username}`}>
                <div className=" fixed bottom-16 left-0 right-0 w-fit mx-auto rounded-full bg-bgLight/90 dark:bg-bgDark/90 backdrop-blur-3xl px-6 py-2 border border-opacityLight dark:border-opacityDark cursor-pointer flex gap-4 justify-center items-center hover:scale-95 duration-300 shadow-card">
                  <Avatar
                    size={{ xs: 40 }}
                    icon={<User className=" size-4 text-[#00000030]" />}
                    className="border"
                    src={rote?.author.avatar}
                  />
                  <div className=" flex gap-2 items-center">
                    <div className=" text-base font-semibold dark:text-textDark text-textLight ">
                      {rote?.author.nickname}
                    </div>
                    <div className=" text-md text-gray-500">
                      @{rote?.author.username}
                    </div>
                  </div>
                </div>
              </Link>
            )}
          </>
        )
        : (
          <div className=" w-full h-full flex justify-center items-center">
            {error}
          </div>
        )}
    </div>
  );
}

export default SingleRotePage;
