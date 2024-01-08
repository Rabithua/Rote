import { UploadOutlined } from "@ant-design/icons";
import { message } from "antd";
import { useRef } from "react";

export default function Uploader({ fileList, setFileList }: any) {
  const fileInputRef = useRef(null);

  return (
    <div className={` ${fileList.length >= 9 ? "hidden" : ""}`}>
      <div
        onClick={() => {
          //@ts-ignore
          fileInputRef.current?.click();
        }}
        className=" active:scale-95 duration-300 cursor-pointer w-20 h-20 flex flex-col items-center justify-center rounded-lg bg-bgWhite border overflow-hidden"
      >
        <UploadOutlined className=" text-2xl " />
      </div>
      <input
        ref={fileInputRef}
        className=" hidden"
        type="file"
        id="file"
        multiple
        accept="image/*"
        onInput={() => {
          const input = document.querySelector("#file");
          //@ts-ignore
          let files = Object.values(input.files);

          const updatedFileList: Array<any> = files.map(async (file: any) => {
            const src = URL.createObjectURL(file);
            return { file, src };
          });

          if (fileList.length + updatedFileList.length > 9) {
            message.error(`文件数量超过限制，已去除多余文件！`);
          }

          Promise.all(updatedFileList).then((newFileList) => {
            setFileList(fileList.concat(newFileList).slice(0, 9));
          });
        }}
      />
    </div>
  );
}
