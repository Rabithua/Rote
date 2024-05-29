import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import GoTop from "@/components/goTop";
import NavBar from "@/components/navBar";
import Rote from "@/components/Rote";
import { apiGetSingleRote } from "@/api/rote/main";
import Avatar from "antd/es/avatar";
import { UserOutlined } from "@ant-design/icons";

function SingleRotePage() {
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

  return (
    <div
      className={` scrollContainer scroll-smooth overscroll-contain flex-1 noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative`}
    >
      <NavBar />
      {rote ? (
        <div className=" flex flex-col items-center">
          <div></div>
          <Rote rote_param={rote} />
        </div>
      ) : (
        <div className=" w-full h-full flex justify-center items-center">
          {msg || "加载中..."}
        </div>
      )}
      {rote && (
        <Link
          className=" w-fit mx-auto rounded-3xl bg-bgWhite px-8 py-4 border cursor-pointer flex gap-4 justify-center items-center"
          to={`/${rote.author.username}`}
        >
          <Avatar
            size={{ xs: 80, sm: 80, md: 80, lg: 100, xl: 100, xxl: 100 }}
            icon={<UserOutlined className=" text-[#00000030]" />}
            src={rote?.author.avatar}
          />
          <div className=" flex flex-col gap-2">
            <div className=" text-2xl font-semibold">
              {rote?.author.nickname}
            </div>
            <div className=" text-base text-gray-500">
              @{rote?.author.username}
            </div>
          </div>
        </Link>
      )}
      <GoTop scrollContainerName="scrollContainer" />
    </div>
  );
}

export default SingleRotePage;
