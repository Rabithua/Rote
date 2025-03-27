import { message } from "antd";
import { Upload } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

export default function Uploader({ fileList, callback, id }: any) {
  const fileInputRef = useRef(null);
  const { t } = useTranslation("translation", {
    keyPrefix: "components.uploader",
  });
  return (
    <div className={` ${fileList.length >= 9 ? "hidden" : ""}`}>
      <div
        onClick={() => {
          //@ts-ignore
          fileInputRef.current?.click();
        }}
        className=" active:scale-95 duration-300 cursor-pointer w-20 h-20 flex flex-col items-center justify-center rounded-lg bg-opacityLight dark:bg-opacityDark border border-opacityLight dark:border-opacityDark overflow-hidden"
      >
        <Upload className=" size-6 " />
      </div>
      <input
        ref={fileInputRef}
        className=" hidden"
        type="file"
        id={`file-${id}`}
        multiple
        accept="image/*"
        onInput={() => {
          const input = document.querySelector(
            `#file-${id}`,
          ) as HTMLInputElement;

          let files = input.files ? Object.values(input.files) : [];

          if (fileList.length + files.length > 9) {
            message.error(t("fileLimit"));
            return [];
          }

          callback(files);
        }}
        title="Attachments Uploader"
      />
    </div>
  );
}
