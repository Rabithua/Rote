import { useTags } from "@/state/tags";
import Empty from "antd/es/empty";
import { Link } from "react-router-dom";

export default function TagMap() {
  const tags = useTags();
  return (
    <>
      {tags.length > 0 ? (
        <div className=" shrink-0 flex gap-2 flex-wrap opacity-0 animate-show duration-300">
          {tags.map((item, index) => {
            return (
              <Link
                key={`tag_${index}`}
                to={"/filter"}
                state={{
                  tags: [item.value],
                }}
              >
                <div className=" px-2 py-1 flex-grow text-center text-xs rounded-md bg-opacityLight dark:bg-opacityDark duration-300 hover:scale-95">
                  {item.value}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className=" shrink-0 border-t-[1px] border-opacityLight dark:border-opacityDark bg-bgLight dark:bg-bgDark py-4">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={"还没有标签"}
          />
        </div>
      )}
    </>
  );
}
