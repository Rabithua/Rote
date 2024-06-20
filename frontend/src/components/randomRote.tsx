import { apiGetRandomRote } from "@/api/rote/main";
import { QuestionOutlined, RedoOutlined } from "@ant-design/icons/lib/icons";
import { useEffect, useState } from "react";
import RoteItem from "./roteItem";
import { Divider } from "antd";

export default function RandomRote() {
  const [rote, setRote] = useState<any>(null);

  useEffect(() => {
    getRandomRoteFun();
  }, []);

  function getRandomRoteFun() {
    apiGetRandomRote()
      .then((res: any) => {
        console.log(res.data);
        setRote(res.data);
      })
      .catch(() => {});
  }
  return (
    rote && (
      <div className=" shrink-0">
        <div className=" flex gap-2 bg-white text-md font-semibold py-2">
          随机回顾 / Random Review
          <RedoOutlined
            className=" p-1 bg-bgWhite rounded-md cursor-pointer hover:scale-90 duration-300 ml-auto text-gray-400"
            onClick={getRandomRoteFun}
          />
        </div>
        <RoteItem rote_param={rote} randomRoteStyle />
      </div>
    )
  );
}
