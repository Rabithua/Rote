import { apiGetSingleRote } from "@/api/rote/main";
import GoTop from "@/components/goTop";
import NavBar from "@/components/navBar";
import Rote from "@/components/roteItem";
import { UserOutlined } from "@ant-design/icons";
import Avatar from "antd/es/avatar";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
function SingleRotePage() {
  const { t } = useTranslation("translation", { keyPrefix: "pages.rote" });
  const navigate = useNavigate();
  const { roteid } = useParams();
  const [rote, setRote] = useState<any>(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (roteid) {
      getRote();
    }
  }, [roteid]);

  async function getRote() {
    apiGetSingleRote(roteid)
      .then((data) => {
        setRote(data.data.data);
      })
      .catch((e) => {
        setMsg(e.response.data.msg);
      });
  }

  function afterDeleteFun() {
    navigate("/home");
  }

  return (
    <div
      className={`flex-1 noScrollBar overflow-y-visible overflow-x-hidden relative pb-20`}
    >
      <NavBar />
      {rote ? (
        <div className=" flex flex-col items-center">
          <div></div>
          <Rote rote_param={rote} afterDelete={afterDeleteFun} />
        </div>
      ) : (
        <div className=" w-full h-full flex justify-center items-center">
          {msg || t("loading")}
        </div>
      )}
      {rote && (
        <Link to={`/${rote.author.username}`}>
          <div className=" fixed bottom-14 left-0 right-0 w-fit mx-auto rounded-full bg-bgDark dark:bg-bgLight px-6 py-2 border border-opacityLight dark:border-opacityDark cursor-pointer flex gap-4 justify-center items-center hover:scale-95 duration-300">
            <Avatar
              size={{ xs: 40 }}
              icon={<UserOutlined className=" text-[#00000030]" />}
              src={rote?.author.avatar}
            />
            <div className=" flex flex-col">
              <div className=" text-base font-semibold dark:text-textLight text-textDark ">
                {rote?.author.nickname}
              </div>
              <div className=" text-md text-gray-500">
                @{rote?.author.username}
              </div>
            </div>
          </div>
        </Link>
      )}
      <GoTop />
    </div>
  );
}

export default SingleRotePage;
