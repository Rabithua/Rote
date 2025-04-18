import { apiGetSingleRote } from "@/api/rote/main";
import LoadingPlaceholder from "@/components/LoadingPlaceholder";
import NavBar from "@/components/navBar";
import RoteItem from "@/components/roteItem";

import { Rote } from "@/types/main";
import { useAPIGet } from "@/utils/fetcher";
import Avatar from "antd/es/avatar";
import { User } from "lucide-react";
import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

function SingleRotePage() {
  // const { t } = useTranslation("translation", { keyPrefix: "pages.rote" });
  const navigate = useNavigate();
  const { roteid } = useParams();

  const {
    data: rote,
    isLoading,
    error,
  } = useAPIGet<Rote>(roteid || "", apiGetSingleRote);

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
      className={`noScrollBar relative flex-1 overflow-x-hidden overflow-y-visible pb-20`}
    >
      <NavBar />
      {isLoading ? (
        <LoadingPlaceholder className="py-8" size={6} />
      ) : rote ? (
        <>
          <div className="flex flex-col items-center pb-16">
            <div></div>
            <RoteItem rote={rote} />
          </div>
          {rote.author && (
            <Link to={`/${rote.author.username}`}>
              <div className="fixed bottom-16 left-0 right-0 mx-auto flex w-fit cursor-pointer items-center justify-center gap-4 rounded-full border border-opacityLight bg-bgLight/90 px-6 py-2 shadow-card backdrop-blur-3xl duration-300 hover:scale-95 dark:border-opacityDark dark:bg-bgDark/90">
                <Avatar
                  size={{ xs: 40 }}
                  icon={<User className="size-4 text-[#00000030]" />}
                  className="border"
                  src={rote?.author.avatar}
                />
                <div className="flex items-center gap-2">
                  <div className="text-base font-semibold text-textLight dark:text-textDark">
                    {rote?.author.nickname}
                  </div>
                  <div className="text-md text-gray-500">
                    @{rote?.author.username}
                  </div>
                </div>
              </div>
            </Link>
          )}
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          {error}
        </div>
      )}
    </div>
  );
}

export default SingleRotePage;
