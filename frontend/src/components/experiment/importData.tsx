import { LoadingOutlined } from "@ant-design/icons";
import { Divider } from "antd";
import { useEffect, useState } from "react";

export default function ImportData() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {}, []);

  return (
    <div className=" w-full min-h-full sm:w-[calc(50%-4px)] relative noScrollBar overflow-y-scroll overflow-x-hidden aspect-1 border border-opacityLight dark:border-opacityDark rounded-xl p-4 bg-opacityLight dark:bg-opacityDark">
      <div className=" text-2xl font-semibold">
        数据导入 <br />
        <div className=" font-normal mt-2 text-sm text-gray-500">
          导入来自其他笔记平台的数据。
        </div>
      </div>
      <Divider></Divider>
      {loading ? (
        <div className=" flex justify-center text-lg items-center py-8 gap-3 bg-bgLight dark:bg-bgDark">
          <LoadingOutlined />
        </div>
      ) : (
        <></>
      )}
    </div>
  );
}
