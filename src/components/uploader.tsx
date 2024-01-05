import { UploadOutlined } from "@ant-design/icons";
import { UploadProps, message, Upload } from "antd";
import { useState } from "react";

export default function Uploader() {
  const [fileList, setFileList] = useState([]) as any;
  const props: UploadProps = {
    maxCount: 9,
    multiple: true,
    name: "file",
    fileList: [],
    // action: "http://127.0.0.1:3000/upload",
    headers: {
      authorization: "authorization-text",
    },
    onChange(info) {
      setFileList(info.fileList);
    },
  };

  return (
    <div>
      <Upload {...props}>
        <div className=" w-20 h-20 flex flex-col items-center justify-center rounded-lg bg-bgWhite border overflow-hidden">
          <UploadOutlined className=" text-2xl " />
        </div>
      </Upload>
    </div>
  );
}
