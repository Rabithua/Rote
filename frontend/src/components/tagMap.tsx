import { apiGetMyTags } from "@/api/rote/main";
import { useAPIGet } from "@/utils/fetcher";
import { Empty } from "antd";
import { ArrowDownLeft } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import LoadingPlaceholder from "./LoadingPlaceholder";

export default function TagMap() {
  const { t } = useTranslation("translation", {
    keyPrefix: "components.tagMap",
  });

  const { data: tags, isLoading } = useAPIGet<string[]>("tags", apiGetMyTags);

  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {isLoading ? (
        <LoadingPlaceholder className="py-8" size={6} />
      ) : tags && tags?.length > 0 ? (
        <div
          className={`flex shrink-0 animate-show flex-wrap gap-2 opacity-0 duration-300 ${
            tags.length > 20 && isCollapsed
              ? "max-h-80 overflow-hidden"
              : "max-h-full"
          }`}
        >
          {tags.map((item: string) => {
            return (
              <Link
                key={item}
                to={"/filter"}
                state={{
                  tags: [item],
                }}
              >
                <div className="flex-grow rounded-md bg-opacityLight px-2 py-1 text-center text-xs duration-300 hover:scale-95 dark:bg-opacityDark">
                  {item}
                </div>
              </Link>
            );
          })}
          {tags.length > 20 && isCollapsed && (
            <div
              onClick={toggleCollapse}
              className="absolute bottom-0 flex w-full cursor-pointer items-center justify-center gap-1 bg-gradient-to-t from-bgLight via-bgLight/80 to-transparent pt-8 text-primary duration-300 dark:from-bgDark dark:via-bgDark/80"
            >
              <ArrowDownLeft className="size-4" />
              {t("expand")}
            </div>
          )}
        </div>
      ) : (
        <div className="shrink-0 border-t-[1px] border-opacityLight bg-bgLight py-4 dark:border-opacityDark dark:bg-bgDark">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("noTags")}
          />
        </div>
      )}
    </>
  );
}
