import { Divider } from "antd";
import { Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function ImportData() {
  const { t } = useTranslation("translation", {
    keyPrefix: "pages.experiment.importData",
  });
  const [loading] = useState(false);

  useEffect(() => {}, []);

  return (
    <div className=" w-full sm:w-[calc(50%-4px)] noScrollBar relative overflow-y-scroll overflow-x-hidden aspect-1 border-b p-4">
      <div className=" text-2xl font-semibold">
        {t("title")} <br />
        <div className=" font-normal mt-2 text-sm text-gray-500">
          {t("description")}
        </div>
      </div>
      <Divider></Divider>
      {loading
        ? (
          <div className=" flex justify-center text-lg items-center py-8 gap-3 bg-bgLight dark:bg-bgDark">
            <Loader className="animate-spin size-6" />
          </div>
        )
        : <></>}
    </div>
  );
}
