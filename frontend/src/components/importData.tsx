import { LoadingOutlined } from "@ant-design/icons";
import { Divider } from "antd";
import { useEffect, useState } from "react";

export default function ImportData() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {}, []);

  return (
    <div className=" w-full min-h-full sm:w-[calc(50%-4px)] relative overflow-y-scroll overflow-x-hidden aspect-1 border border-[#00000015] rounded-xl p-4">
      <div className=" text-2xl font-semibold">
        数据导入 <br />
        <div className=" font-normal mt-2 text-sm text-gray-500">
          导入来自其他笔记平台的数据。
        </div>
      </div>
      <Divider></Divider>
      {loading ? (
        <div className=" flex justify-center text-lg items-center py-8 gap-3 bg-white">
          <LoadingOutlined />
        </div>
      ) : (
        <></>
      )}
    </div>
  );
}
