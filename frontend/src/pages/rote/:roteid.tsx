import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import GoTop from "@/components/goTop";
import NavBar from "@/components/navBar";
import Rote from "@/components/rote";
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
      className={` scrollContainer scroll-smooth overscroll-contain flex-1 noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative pb-20`}
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
          className=" fixed bottom-12 left-0 right-0 w-fit mx-auto rounded-full bg-bgWhite px-6 py-2 border cursor-pointer flex gap-4 justify-center items-center"
          to={`/${rote.author.username}`}
        >
          <Avatar
            size={{ xs: 40 }}
            icon={<UserOutlined className=" text-[#00000030]" />}
            src={rote?.author.avatar}
          />
          <div className=" flex flex-col">
            <div className=" text-base font-semibold">
              {rote?.author.nickname}
            </div>
            <div className=" text-md text-gray-500">
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
