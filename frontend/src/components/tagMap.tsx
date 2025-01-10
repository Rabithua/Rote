import { useTags } from "@/state/tags";
import Empty from "antd/es/empty";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { DownOutlined } from "@ant-design/icons";

export default function TagMap() {
  const { t } = useTranslation("translation", {
    keyPrefix: "components.tagMap",
  });

  const [tags] = useTags();

  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {tags.length > 0 ? (
        <div
          className={` shrink-0 flex gap-2 flex-wrap opacity-0 animate-show duration-300 ${
            tags.length > 20 && isCollapsed
              ? "max-h-80 overflow-hidden"
              : "max-h-full"
          }`}
        >
          {tags.map((item, index) => {
            return (
              <Link
                key={item.value}
                to={"/filter"}
                state={{
                  tags: [item.value],
                }}
              >
                <div className="px-2 py-1 flex-grow text-center text-xs rounded-md bg-opacityLight dark:bg-opacityDark duration-300 hover:scale-95">
                  {item.value}
                </div>
              </Link>
            );
          })}
          {tags.length > 20 && isCollapsed && (
            <div
              onClick={toggleCollapse}
              className="hover:text-primary cursor-pointer gap-1 duration-300 absolute bottom-0 bg-gradient-to-t text-gray-700 from-bgLight dark:from-bgDark via-bgLight/80 dark:via-bgDark/80 to-transparent pt-8 flex w-full justify-center"
            >
              <DownOutlined />
              {t("expand")}
            </div>
          )}
        </div>
      ) : (
        <div className="shrink-0 border-t-[1px] border-opacityLight dark:border-opacityDark bg-bgLight dark:bg-bgDark py-4">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("noTags")}
          />
        </div>
      )}
    </>
  );
}
