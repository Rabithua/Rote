import { apiGetRandomRote } from "@/api/rote/main";
import { QuestionOutlined, RedoOutlined } from "@ant-design/icons/lib/icons";
import { useEffect, useState } from "react";
import RoteItem from "./roteItem";
import { Divider } from "antd";

export default function RandomRote() {
  const [rote, setRote] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRandomRoteFun();
  }, []);

  function getRandomRoteFun() {
    setLoading(true);
    apiGetRandomRote()
      .then((res: any) => {
        setLoading(false);
        console.log(res.data);
        setRote(res.data);
      })
      .catch(() => {
        setLoading(false);
      });
  }
  return (
    rote && (
      <div className=" shrink-0">
        <div className=" flex gap-2 bg-white text-md font-semibold py-2">
          随机回顾 / Random Review
          <RedoOutlined
            className={` cursor-pointer hover:opacity-50 duration-300 ml-auto ${
              loading && "animate-spin"
            }`}
            onClick={getRandomRoteFun}
          />
        </div>
        <RoteItem rote_param={rote} randomRoteStyle />
      </div>
    )
  );
}
