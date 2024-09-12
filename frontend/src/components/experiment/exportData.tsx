import { apiGetStatistics } from "@/api/rote/main";
import { DownloadOutlined, LoadingOutlined } from "@ant-design/icons";
import { Divider } from "antd";
import { useEffect, useState } from "react";

export default function ExportData() {
  const [loading, setLoading] = useState(true);
  const [statisics, setStatistics] = useState<any>({
    noteCount: 0,
    attachmentsCount: 0,
  });

  function exportData() {
    apiGetStatistics()
      .then((res: any) => {
        setLoading(false);
        console.log(res);
        setStatistics(res.data);
      })
      .catch(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    exportData();
  }, []);

  return (
    <div className=" w-full min-h-full sm:w-[calc(50%-4px)] relative noScrollBar overflow-y-scroll overflow-x-hidden aspect-1 border border-opacityLight dark:border-opacityDark rounded-xl p-4 bg-opacityLight dark:bg-opacityDark">
      <div className=" text-2xl font-semibold">
        数据导出 <br />
        <div className=" font-normal mt-2 text-sm text-gray-500">
          导出完整的数据，以便在其他地方使用，json 格式。
        </div>
      </div>
      <Divider></Divider>
      {loading ? (
        <div className=" flex justify-center text-lg items-center py-8 gap-3 bg-bgLight dark:bg-bgDark">
          <LoadingOutlined />
        </div>
      ) : (
        <>
          <div className=" flex items-center justify-around p-4">
            <div className=" flex flex-col justify-center items-center gap-2">
              <div className=" text-4xl font-semibold">
                {statisics.noteCount}
              </div>
              <div className=" text-sm text-gray-500">笔记数量</div>
            </div>
            <div className=" flex flex-col justify-center items-center gap-2">
              <div className=" text-4xl font-semibold">
                {statisics.attachmentsCount}
              </div>
              <div className=" text-sm text-gray-500">附件数量</div>
            </div>
          </div>
          <a
            href={`${process.env.REACT_APP_BASEURL_PRD}/v1/api/exportData`}
            className=" mx-auto mt-6 w-fit cursor-pointer select-none hover:text-white duration-300 flex items-center gap-2 bg-black text-white px-6 py-2 rounded-md active:scale-95"
            target="_blank"
            rel="noreferrer"
          >
            <DownloadOutlined />
            下载 Json 格式数据
          </a>
        </>
      )}
    </div>
  );
}
